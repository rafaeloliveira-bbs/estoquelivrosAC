from sqlalchemy.orm import Session
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
    """
    Get current stock report for a branch.
    Shows: title, author, total quantity, total value
    """
    result = []
    
    livros = db.query(Livro).filter(
        Livro.filial_id == filial_id,
        Livro.status == "ativo"
    ).all()
    
    for livro in livros:
        lotes = db.query(Lote).filter(
            Lote.livro_id == livro.id,
            Lote.filial_id == filial_id
        ).all()
        
        qtd_total = sum(lote.quantidade_disponivel for lote in lotes)
        valor_total = sum(
            lote.quantidade_disponivel * lote.preco_custo_unitario 
            for lote in lotes
        )
        
        if qtd_total > 0 or lotes:  # Include items with stock
            result.append({
                "livro_id": livro.id,
                "titulo": livro.titulo,
                "autor": livro.autor,
                "isbn": livro.isbn,
                "quantidade_total": qtd_total,
                "valor_total": float(valor_total),
                "preco_medio_unitario": float(valor_total / qtd_total) if qtd_total > 0 else 0,
                "estoque_minimo": livro.estoque_minimo,
                "em_alerta": qtd_total <= livro.estoque_minimo if livro.estoque_minimo else False
            })
    
    return sorted(result, key=lambda x: x["titulo"])

def relatorio_movimentacoes(
    db: Session, 
    filial_id: int, 
    data_inicio: date, 
    data_fim: date
) -> list:
    """
    Get movements report for a period.
    """
    movs = db.query(Movimentacao).filter(
        Movimentacao.filial_id == filial_id,
        Movimentacao.data_movimento.between(data_inicio, data_fim)
    ).order_by(Movimentacao.data_movimento.desc()).all()
    
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
            "documento": m.documento_referencia
        })
    
    return result

def relatorio_top_vendas(
    db: Session,
    filial_id: int,
    limite: int = 10,
    mes: int = None,
    ano: int = None
) -> list:
    """
    Get top selling books report.
    """
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
            "ticket_medio": float((row.total_valor or 0) / (row.total_qtd or 1))
        })
    
    return result

def relatorio_alertas_minimo(db: Session, filial_id: int) -> list:
    """
    Get alert report for minimum stock items.
    """
    alertas = db.query(AlertaMinimo).filter(
        AlertaMinimo.filial_id == filial_id,
        AlertaMinimo.ativo == True
    ).all()
    
    result = []
    for alerta in alertas:
        livro = alerta.livro
        estoque_atual = db.query(func.sum(Lote.quantidade_disponivel)).filter(
            Lote.livro_id == livro.id,
            Lote.filial_id == filial_id
        ).scalar() or 0
        
        result.append({
            "livro_id": livro.id,
            "titulo": livro.titulo,
            "isbn": livro.isbn,
            "estoque_atual": int(estoque_atual),
            "minimo_configurado": alerta.minimo_configurado,
            "diferenca": int(estoque_atual) - alerta.minimo_configurado,
            "criado_em": alerta.criado_em.strftime("%d/%m/%Y"),
            "ativo": alerta.ativo
        })
    
    return sorted(result, key=lambda x: x["diferenca"])

def relatorio_lotes_vencimento(
    db: Session,
    filial_id: int,
    dias_proximos: int = 30
) -> list:
    """
    Get report of batches approaching expiration.
    """
    data_limite = date.today() + relativedelta(days=dias_proximos)
    
    lotes = db.query(Lote).filter(
        Lote.filial_id == filial_id,
        Lote.validade_minima.isnot(None),
        Lote.validade_minima <= data_limite,
        Lote.quantidade_disponivel > 0
    ).order_by(Lote.validade_minima.asc()).all()
    
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
            "urgencia": "CRITICO" if dias_restantes <= 7 else "AVISO" if dias_restantes <= 14 else "INFO"
        })
    
    return result
