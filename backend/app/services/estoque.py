from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.lote import Lote
from app.models.livro import Livro
from app.models.movimentacao import Movimentacao
from app.models.alerta_minimo import AlertaMinimo
from app.crud.movimentacao import criar_movimentacao
from datetime import datetime
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

def obter_estoque_total(db: Session, livro_id: int, filial_id: int) -> int:
    """Get total available stock for a book"""
    total = db.query(func.sum(Lote.quantidade_disponivel)).filter(
        Lote.livro_id == livro_id,
        Lote.filial_id == filial_id,
        Lote.quantidade_disponivel > 0
    ).scalar() or 0
    return int(total)

def obter_custo_medio_peps(
    db: Session, 
    livro_id: int, 
    filial_id: int, 
    quantidade_solicitada: int
) -> dict:
    """
    Calculate cost using FIFO method.
    Returns the total cost and list of batches used.
    """
    lotes = db.query(Lote).filter(
        Lote.livro_id == livro_id,
        Lote.filial_id == filial_id,
        Lote.quantidade_disponivel > 0
    ).order_by(Lote.data_entrada.asc()).all()  # FIFO: oldest first
    
    custo_total = Decimal(0)
    quantidade_restante = quantidade_solicitada
    lotes_usados = []
    
    for lote in lotes:
        if quantidade_restante <= 0:
            break
        
        quantidade_do_lote = min(lote.quantidade_disponivel, quantidade_restante)
        custo_lote = quantidade_do_lote * lote.preco_custo_unitario
        custo_total += custo_lote
        
        lotes_usados.append({
            "lote_id": lote.id,
            "quantidade": quantidade_do_lote,
            "preco_unitario": float(lote.preco_custo_unitario),
            "custo_total": float(custo_lote)
        })
        
        quantidade_restante -= quantidade_do_lote
    
    if quantidade_restante > 0:
        raise ValueError(f"Estoque insuficiente. Faltam {quantidade_restante} unidades.")
    
    return {
        "custo_total": float(custo_total),
        "lotes_usados": lotes_usados,
        "preco_unitario_medio": float(custo_total / quantidade_solicitada) if quantidade_solicitada > 0 else 0
    }

def registrar_venda(
    db: Session,
    livro_id: int,
    quantidade: int,
    usuario_id: int,
    filial_id: int,
    motivo: str = None,
    documento_referencia: str = None,
    observacoes: str = None
) -> dict:
    """
    Register a sale using FIFO method.
    """
    try:
        # Get cost info using FIFO
        custo_info = obter_custo_medio_peps(db, livro_id, filial_id, quantidade)
        
        # Create movements for each batch used
        for lote_uso in custo_info["lotes_usados"]:
            mov = Movimentacao(
                filial_id=filial_id,
                lote_id=lote_uso["lote_id"],
                usuario_id=usuario_id,
                tipo="venda",
                quantidade=lote_uso["quantidade"],
                preco_unitario=Decimal(str(lote_uso["preco_unitario"])),
                motivo=motivo,
                documento_referencia=documento_referencia,
                observacoes=observacoes,
                data_movimento=datetime.utcnow()
            )
            criar_movimentacao(db, mov)
            
            # Update batch availability
            lote = db.query(Lote).filter(Lote.id == lote_uso["lote_id"]).first()
            if lote:
                lote.quantidade_disponivel -= lote_uso["quantidade"]
                db.add(lote)
        
        db.commit()
        
        logger.info(f"Venda registrada: livro_id={livro_id}, quantidade={quantidade}, usuario_id={usuario_id}")
        
        return {
            "status": "sucesso",
            "custo_total": custo_info["custo_total"],
            "preco_unitario_medio": custo_info["preco_unitario_medio"],
            "quantidade": quantidade
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao registrar venda: {str(e)}")
        raise

def registrar_compra(
    db: Session,
    livro_id: int,
    quantidade: int,
    preco_unitario: Decimal,
    usuario_id: int,
    filial_id: int,
    numero_lote: str,
    fornecedor: str = None,
    data_entrada = None,
    validade_minima = None,
    observacoes: str = None
) -> dict:
    """
    Register a purchase (creates a new batch).
    """
    try:
        from datetime import date
        from app.crud.lote import criar_lote
        from app.schemas.lote import LoteCriar
        
        if data_entrada is None:
            data_entrada = date.today()
        
        # Create batch
        lote_data = LoteCriar(
            livro_id=livro_id,
            filial_id=filial_id,
            numero_lote=numero_lote,
            quantidade_inicial=quantidade,
            preco_custo_unitario=preco_unitario,
            data_entrada=data_entrada,
            fornecedor=fornecedor,
            validade_minima=validade_minima
        )
        lote = criar_lote(db, lote_data)
        
        # Create movement
        mov = Movimentacao(
            filial_id=filial_id,
            lote_id=lote.id,
            usuario_id=usuario_id,
            tipo="compra",
            quantidade=quantidade,
            preco_unitario=preco_unitario,
            observacoes=observacoes,
            data_movimento=datetime.utcnow()
        )
        criar_movimentacao(db, mov)
        
        logger.info(f"Compra registrada: livro_id={livro_id}, quantidade={quantidade}, lote_id={lote.id}")
        
        return {
            "status": "sucesso",
            "lote_id": lote.id,
            "custo_total": float(quantidade * preco_unitario),
            "quantidade": quantidade
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao registrar compra: {str(e)}")
        raise
