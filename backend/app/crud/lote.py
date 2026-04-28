from sqlalchemy.orm import Session
from app.models.lote import Lote
from app.schemas.lote import LoteCriar, LoteAtualizar

def criar_lote(db: Session, lote: LoteCriar):
    """Create new batch"""
    db_lote = Lote(
        livro_id=lote.livro_id,
        filial_id=lote.filial_id,
        numero_lote=lote.numero_lote,
        quantidade_inicial=lote.quantidade_inicial,
        quantidade_disponivel=lote.quantidade_inicial,
        preco_custo_unitario=lote.preco_custo_unitario,
        data_entrada=lote.data_entrada,
        fornecedor=lote.fornecedor,
        validade_minima=lote.validade_minima
    )
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)
    return db_lote

def obter_lote_por_id(db: Session, lote_id: int):
    """Get batch by ID"""
    return db.query(Lote).filter(Lote.id == lote_id).first()

def listar_lotes_por_livro(db: Session, livro_id: int, filial_id: int):
    """List batches for a book, ordered by entry date (FIFO)"""
    return db.query(Lote).filter(
        Lote.livro_id == livro_id,
        Lote.filial_id == filial_id,
        Lote.quantidade_disponivel > 0
    ).order_by(Lote.data_entrada.asc()).all()

def listar_lotes_filial(db: Session, filial_id: int, skip: int = 0, limit: int = 100):
    """List all batches for a branch"""
    return db.query(Lote).filter(
        Lote.filial_id == filial_id
    ).order_by(Lote.data_entrada.desc()).offset(skip).limit(limit).all()

def atualizar_lote(db: Session, lote_id: int, lote_data: LoteAtualizar):
    """Update batch"""
    db_lote = obter_lote_por_id(db, lote_id)
    if not db_lote:
        return None
    
    update_data = lote_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_lote, field, value)
    
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)
    return db_lote

def deletar_lote(db: Session, lote_id: int):
    """Delete batch (only if quantity is 0)"""
    db_lote = obter_lote_por_id(db, lote_id)
    if db_lote and db_lote.quantidade_disponivel == 0:
        db.delete(db_lote)
        db.commit()
        return db_lote
    return None
