from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, and_
from app.models.movimentacao import Movimentacao
from app.models.livro import Livro
from app.models.lote import Lote
from app.models.alerta_minimo import AlertaMinimo
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
    filters = [
        _filial_clause(Movimentacao, filial_id),
        Movimentacao.data_movimento <= data_fim,
    ]
    if data_inicio:
        filters.append(Movimentacao.data_movimento >= data_inicio)
    if tipo:
        filters.append(Movimentacao.tipo == tipo.lower())

    movs = (
        db.query(Movimentacao)
        .options(
            joinedload(Movimentacao.lote).joinedload(Lote.livro),
            joinedload(Movimentacao.livro),
            joinedload(Movimentacao.usuario),
        )
        .filter(*filters)
        .order_by(Movimentacao.data_movimento.desc())
        .all()
    )

    result = []
    for m in movs:
        livro_obj = (m.lote.livro if m.lote and m.lote.livro else m.livro)
        result.append({
            "data": m.data_movimento.strftime("%d/%m/%Y %H:%M"),
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
