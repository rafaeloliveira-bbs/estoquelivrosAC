from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import func, extract, and_, case, cast
from sqlalchemy import Date as SADate
from app.models.movimentacao import Movimentacao
from app.models.livro import Livro
from app.models.lote import Lote
from app.models.alerta_minimo import AlertaMinimo
from app.models.filial import Filial
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import logging

logger = logging.getLogger(__name__)


def _filial_clause(model, filial_id):
    """Suporta filial_id como int ou list[int]."""
    if isinstance(filial_id, list):
        return model.filial_id.in_(filial_id)
    return model.filial_id == filial_id


def relatorio_estoque_atual(db: Session, filial_id) -> list:
    estoque_sub = (
        db.query(
            Lote.livro_id,
            func.coalesce(func.sum(Lote.quantidade_disponivel), 0).label("qtd_total"),
            func.coalesce(
                func.sum(Lote.quantidade_disponivel * Lote.preco_custo_unitario), 0
            ).label("valor_total"),
        )
        .filter(_filial_clause(Lote, filial_id))
        .group_by(Lote.livro_id)
        .subquery()
    )

    rows = (
        db.query(
            Livro.id,
            Livro.titulo,
            Livro.autor,
            Livro.isbn,
            Livro.estoque_minimo,
            func.coalesce(estoque_sub.c.qtd_total, 0).label("qtd_total"),
            func.coalesce(estoque_sub.c.valor_total, 0).label("valor_total"),
        )
        .outerjoin(estoque_sub, estoque_sub.c.livro_id == Livro.id)
        .filter(_filial_clause(Livro, filial_id), Livro.status == "ativo")
        .order_by(Livro.titulo)
        .all()
    )

    result = []
    for row in rows:
        qtd = int(row.qtd_total)
        valor = float(row.valor_total)
        result.append({
            "livro_id": row.id,
            "titulo": row.titulo,
            "autor": row.autor,
            "isbn": row.isbn,
            "quantidade_total": qtd,
            "valor_total": valor,
            "preco_medio_unitario": valor / qtd if qtd > 0 else 0,
            "estoque_minimo": row.estoque_minimo,
            "em_alerta": qtd <= row.estoque_minimo if row.estoque_minimo else False,
        })
    return result

def relatorio_movimentacoes(
    db: Session,
    filial_id,
    data_inicio: date | None,
    data_fim: date,
    tipo: str | None = None,
) -> list:
    # Para compras com lote, a data efetiva é data_entrada do lote (corrige registros
    # antigos onde data_movimento foi gravada como data do import em vez da data real)
    data_efetiva = case(
        (and_(Movimentacao.tipo == 'compra', Lote.data_entrada.isnot(None)),
         cast(Lote.data_entrada, SADate)),
        else_=cast(Movimentacao.data_movimento, SADate),
    )

    filters = [
        _filial_clause(Movimentacao, filial_id),
        data_efetiva <= data_fim,
    ]
    if data_inicio:
        filters.append(data_efetiva >= data_inicio)
    if tipo:
        filters.append(Movimentacao.tipo == tipo.lower())

    movs = (
        db.query(Movimentacao)
        .outerjoin(Movimentacao.lote)
        .options(
            contains_eager(Movimentacao.lote).joinedload(Lote.livro),
            joinedload(Movimentacao.livro),
            joinedload(Movimentacao.usuario),
        )
        .filter(*filters)
        .order_by(data_efetiva.desc())
        .all()
    )

    result = []
    for m in movs:
        livro_obj = (m.lote.livro if m.lote and m.lote.livro else m.livro)
        dt = (
            datetime.combine(m.lote.data_entrada, datetime.min.time())
            if m.tipo == 'compra' and m.lote and m.lote.data_entrada
            else m.data_movimento
        )
        result.append({
            "data": dt.strftime("%d/%m/%Y %H:%M"),
            "tipo": m.tipo.upper(),
            "livro_titulo": livro_obj.titulo if livro_obj else "N/A",
            "isbn": livro_obj.isbn if livro_obj else "N/A",
            "quantidade": m.quantidade,
            "preco_unitario": float(m.preco_unitario),
            "valor_total": float(m.quantidade * m.preco_unitario),
            "usuario": m.usuario.nome if m.usuario else "Sistema",
            "motivo": m.motivo,
            "documento": m.documento_referencia,
        })
    return result

def relatorio_top_vendas(
    db: Session,
    filial_id,
    limite: int = 10,
    mes: int = None,
    ano: int = None
) -> list:
    query = (
        db.query(
            Livro.titulo,
            Livro.isbn,
            func.sum(Movimentacao.quantidade).label("total_qtd"),
            func.sum(Movimentacao.quantidade * Movimentacao.preco_unitario).label("total_valor"),
        )
        .select_from(Movimentacao)
        .outerjoin(Lote, Lote.id == Movimentacao.lote_id)
        .join(Livro, Livro.id == func.coalesce(Lote.livro_id, Movimentacao.livro_id))
        .filter(
            _filial_clause(Movimentacao, filial_id),
            Movimentacao.tipo == "venda",
        )
    )

    if mes:
        query = query.filter(extract('month', Movimentacao.data_movimento) == mes)
    if ano:
        query = query.filter(extract('year', Movimentacao.data_movimento) == ano)

    query = query.group_by(Livro.id, Livro.titulo, Livro.isbn).order_by(
        func.sum(Movimentacao.quantidade).desc()
    ).limit(limite)

    result = []
    for row in query.all():
        result.append({
            "titulo": row.titulo,
            "isbn": row.isbn,
            "quantidade_vendida": int(row.total_qtd or 0),
            "valor_total": float(row.total_valor or 0),
            "ticket_medio": float((row.total_valor or 0) / (row.total_qtd or 1)),
        })
    return result

def relatorio_alertas_minimo(db: Session, filial_id) -> list:
    estoque_sub = (
        db.query(
            Lote.livro_id,
            func.coalesce(func.sum(Lote.quantidade_disponivel), 0).label("estoque_atual"),
        )
        .filter(_filial_clause(Lote, filial_id))
        .group_by(Lote.livro_id)
        .subquery()
    )

    rows = (
        db.query(AlertaMinimo, Livro, func.coalesce(estoque_sub.c.estoque_atual, 0).label("estoque_atual"))
        .join(Livro, Livro.id == AlertaMinimo.livro_id)
        .outerjoin(estoque_sub, estoque_sub.c.livro_id == AlertaMinimo.livro_id)
        .filter(_filial_clause(AlertaMinimo, filial_id), AlertaMinimo.ativo == True)
        .all()
    )

    result = []
    for alerta, livro, estoque_atual in rows:
        estoque = int(estoque_atual)
        result.append({
            "livro_id": livro.id,
            "titulo": livro.titulo,
            "isbn": livro.isbn,
            "estoque_atual": estoque,
            "minimo_configurado": alerta.minimo_configurado,
            "diferenca": estoque - alerta.minimo_configurado,
            "criado_em": alerta.criado_em.strftime("%d/%m/%Y"),
            "ativo": alerta.ativo,
        })
    return sorted(result, key=lambda x: x["diferenca"])

def relatorio_lotes_vencimento(
    db: Session,
    filial_id,
    dias_proximos: int = 30
) -> list:
    data_limite = date.today() + relativedelta(days=dias_proximos)

    lotes = (
        db.query(Lote)
        .options(joinedload(Lote.livro))
        .filter(
            _filial_clause(Lote, filial_id),
            Lote.validade_minima.isnot(None),
            Lote.validade_minima <= data_limite,
            Lote.quantidade_disponivel > 0,
        )
        .order_by(Lote.validade_minima.asc())
        .all()
    )

    result = []
    for lote in lotes:
        dias_restantes = (lote.validade_minima - date.today()).days
        result.append({
            "lote_id": lote.id,
            "numero_lote": lote.numero_lote,
            "livro_titulo": lote.livro.titulo,
            "isbn": lote.livro.isbn,
            "quantidade_disponivel": lote.quantidade_disponivel,
            "data_validade": lote.validade_minima.strftime("%d/%m/%Y"),
            "dias_restantes": dias_restantes,
            "urgencia": "CRITICO" if dias_restantes <= 7 else "AVISO" if dias_restantes <= 14 else "INFO",
        })
    return result


def relatorio_evolucao_estoque(db: Session, filial_id) -> dict:
    from calendar import monthrange
    from collections import defaultdict

    # Gera lista de meses de dez/2024 até o mês atual
    start = date(2024, 12, 1)
    today = date.today()
    current = date(today.year, today.month, 1)

    months: list[date] = []
    m = start
    while m <= current:
        months.append(m)
        m = (m.replace(day=28) + relativedelta(months=1)).replace(day=1)

    # Todos os livros da filial, ordenados por código e título
    livros = (
        db.query(Livro)
        .filter(_filial_clause(Livro, filial_id))
        .order_by(Livro.codigo_item, Livro.titulo)
        .all()
    )

    # Todos os movimentos da filial com livro_id e data_entrada do lote via join
    all_movs_raw = (
        db.query(
            Movimentacao.tipo,
            Movimentacao.quantidade,
            Movimentacao.preco_unitario,
            Movimentacao.data_movimento,
            func.coalesce(Lote.livro_id, Movimentacao.livro_id).label("livro_id"),
            Lote.data_entrada,
        )
        .outerjoin(Lote, Movimentacao.lote_id == Lote.id)
        .filter(_filial_clause(Movimentacao, filial_id))
        .all()
    )

    # Data efetiva: compras usam data_entrada do lote (corrige imports históricos
    # gravados com data_movimento = data do import em vez da data real da entrada)
    def _data_efetiva(mv) -> datetime:
        if mv.tipo == 'compra' and mv.data_entrada:
            return datetime.combine(mv.data_entrada, datetime.min.time())
        return mv.data_movimento

    all_movs = sorted(all_movs_raw, key=_data_efetiva)

    movs_by_livro: dict[int, list] = defaultdict(list)
    for mov in all_movs:
        movs_by_livro[mov.livro_id].append(mov)

    itens = []
    for livro in livros:
        movs = movs_by_livro.get(livro.id, [])
        if not movs:
            continue  # ignora livros sem nenhuma movimentação

        running_qty = 0
        running_compra_qty = 0
        running_compra_valor = 0.0
        mov_idx = 0
        meses_data: dict[str, dict] = {}

        for month in months:
            last_day = monthrange(month.year, month.month)[1]
            month_end = datetime(month.year, month.month, last_day, 23, 59, 59)

            while mov_idx < len(movs):
                dm = _data_efetiva(movs[mov_idx])
                if dm <= month_end:
                    mv = movs[mov_idx]
                    if mv.tipo in ('compra', 'devolucao'):
                        running_qty += mv.quantidade
                        if mv.tipo == 'compra':
                            running_compra_qty += mv.quantidade
                            running_compra_valor += float(mv.preco_unitario) * mv.quantidade
                    elif mv.tipo in ('venda', 'emprestimo'):
                        running_qty -= mv.quantidade
                    mov_idx += 1
                else:
                    break

            preco_medio = (
                running_compra_valor / running_compra_qty
                if running_compra_qty > 0
                else float(livro.preco_custo or 0)
            )
            qty = max(0, running_qty)
            key = f"{month.year}-{month.month:02d}"
            meses_data[key] = {
                "quantidade": qty,
                "valor_total": round(qty * preco_medio, 2),
            }

        itens.append({
            "codigo_item": livro.codigo_item,
            "grade": livro.grade or "",
            "titulo": livro.titulo,
            "meses": meses_data,
        })

    return {
        "meses": [f"{m.year}-{m.month:02d}" for m in months],
        "itens": itens,
    }


def relatorio_dashboard_por_filial(db: Session, filial_ids) -> list:
    if isinstance(filial_ids, int):
        filial_ids = [filial_ids]

    result = []

    for fid in filial_ids:
        filial = db.query(Filial).filter(Filial.id == fid).first()
        if not filial:
            continue

        # Resolve livro_id: lote-based moves use Lote.livro_id, direct moves use Movimentacao.livro_id
        livro_id_col = func.coalesce(Lote.livro_id, Movimentacao.livro_id)

        mov_sub = (
            db.query(
                livro_id_col.label("livro_id"),
                func.sum(
                    case(
                        (Movimentacao.tipo.in_(["compra", "devolucao"]), Movimentacao.quantidade),
                        else_=0,
                    )
                ).label("entradas"),
                func.sum(
                    case(
                        (Movimentacao.tipo.in_(["venda", "emprestimo"]), Movimentacao.quantidade),
                        else_=0,
                    )
                ).label("saidas"),
                func.sum(
                    case(
                        (Movimentacao.tipo == "compra",
                         Movimentacao.quantidade * Movimentacao.preco_unitario),
                        else_=0,
                    )
                ).label("valor_compras"),
                func.sum(
                    case(
                        (Movimentacao.tipo == "compra", Movimentacao.quantidade),
                        else_=0,
                    )
                ).label("qtd_compras"),
            )
            .outerjoin(Lote, Movimentacao.lote_id == Lote.id)
            .filter(Movimentacao.filial_id == fid)
            .group_by(livro_id_col)
            .subquery()
        )

        rows = (
            db.query(
                Livro.id,
                Livro.titulo,
                Livro.isbn,
                Livro.estoque_minimo,
                Livro.preco_custo,
                func.coalesce(mov_sub.c.entradas, 0).label("entradas"),
                func.coalesce(mov_sub.c.saidas, 0).label("saidas"),
                func.coalesce(mov_sub.c.valor_compras, 0).label("valor_compras"),
                func.coalesce(mov_sub.c.qtd_compras, 0).label("qtd_compras"),
            )
            .outerjoin(mov_sub, mov_sub.c.livro_id == Livro.id)
            .filter(Livro.filial_id == fid, Livro.status == "ativo")
            .all()
        )

        livros_data = []
        valor_total_filial = 0.0
        total_unidades = 0

        for row in rows:
            qtd = max(0, int(row.entradas) - int(row.saidas))
            qtd_compras = int(row.qtd_compras)
            preco_medio = (
                float(row.valor_compras) / qtd_compras
                if qtd_compras > 0
                else float(row.preco_custo or 0)
            )
            valor = round(qtd * preco_medio, 2)
            valor_total_filial += valor
            total_unidades += qtd
            livros_data.append({
                "livro_id": row.id,
                "titulo": row.titulo,
                "isbn": row.isbn,
                "quantidade_total": qtd,
                "valor_total": valor,
                "estoque_minimo": row.estoque_minimo,
            })

        top_por_valor = sorted(
            [l for l in livros_data if l["valor_total"] > 0],
            key=lambda x: x["valor_total"],
            reverse=True,
        )[:10]

        sem_estoque = [
            {
                "livro_id": l["livro_id"],
                "titulo": l["titulo"],
                "isbn": l["isbn"],
                "estoque_minimo": l["estoque_minimo"],
            }
            for l in livros_data
            if l["quantidade_total"] == 0
        ]

        result.append({
            "filial_id": fid,
            "filial_nome": filial.nome,
            "valor_total_estoque": round(valor_total_filial, 2),
            "total_titulos_ativos": len(livros_data),
            "total_unidades": total_unidades,
            "titulos_sem_estoque": len(sem_estoque),
            "top_por_valor": top_por_valor,
            "sem_estoque": sem_estoque[:20],
        })

    return result
