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

def relatorio_estoque_atual(db: Session, filial_id: int) -> list:
    estoque_sub = (
        db.query(
            Lote.livro_id,
            func.coalesce(func.sum(Lote.quantidade_disponivel), 0).label("qtd_total"),
            func.coalesce(
                func.sum(Lote.quantidade_disponivel * Lote.preco_custo_unitario), 0
            ).label("valor_total"),
        )
        .filter(Lote.filial_id == filial_id)
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
        .filter(Livro.filial_id == filial_id, Livro.status == "ativo")
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
    filial_id: int,
    data_inicio: date | None,
    data_fim: date
) -> list:
    filters = [
        Movimentacao.filial_id == filial_id,
        Movimentacao.data_movimento <= data_fim,
    ]
    if data_inicio:
        filters.append(Movimentacao.data_movimento >= data_inicio)

    movs = (
        db.query(Movimentacao)
        .options(
            joinedload(Movimentacao.lote).joinedload(Lote.livro),
            joinedload(Movimentacao.usuario),
        )
        .filter(*filters)
        .order_by(Movimentacao.data_movimento.desc())
        .all()
    )

    result = []
    for m in movs:
        result.append({
            "data": m.data_movimento.strftime("%d/%m/%Y %H:%M"),
            "tipo": m.tipo.upper(),
            "livro_titulo": m.lote.livro.titulo if m.lote and m.lote.livro else "N/A",
            "isbn": m.lote.livro.isbn if m.lote and m.lote.livro else "N/A",
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
    filial_id: int,
    limite: int = 10,
    mes: int = None,
    ano: int = None
) -> list:
    query = db.query(
        Livro.titulo,
        Livro.isbn,
        func.sum(Movimentacao.quantidade).label("total_qtd"),
        func.sum(Movimentacao.quantidade * Movimentacao.preco_unitario).label("total_valor")
    ).join(Lote, Lote.livro_id == Livro.id).join(
        Movimentacao, Movimentacao.lote_id == Lote.id
    ).filter(
        Livro.filial_id == filial_id,
        Movimentacao.tipo == "venda"
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

def relatorio_alertas_minimo(db: Session, filial_id: int) -> list:
    estoque_sub = (
        db.query(
            Lote.livro_id,
            func.coalesce(func.sum(Lote.quantidade_disponivel), 0).label("estoque_atual"),
        )
        .filter(Lote.filial_id == filial_id)
        .group_by(Lote.livro_id)
        .subquery()
    )

    rows = (
        db.query(AlertaMinimo, Livro, func.coalesce(estoque_sub.c.estoque_atual, 0).label("estoque_atual"))
        .join(Livro, Livro.id == AlertaMinimo.livro_id)
        .outerjoin(estoque_sub, estoque_sub.c.livro_id == AlertaMinimo.livro_id)
        .filter(AlertaMinimo.filial_id == filial_id, AlertaMinimo.ativo == True)
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
    filial_id: int,
    dias_proximos: int = 30
) -> list:
    data_limite = date.today() + relativedelta(days=dias_proximos)

    lotes = (
        db.query(Lote)
        .options(joinedload(Lote.livro))
        .filter(
            Lote.filial_id == filial_id,
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
