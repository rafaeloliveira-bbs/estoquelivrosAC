from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.movimentacao import Movimentacao
from app.models.lote import Lote
from app.models.livro import Livro
from app.schemas.movimentacao import MovimentacaoCriar, MovimentacaoAtualizar
from datetime import datetime

def criar_movimentacao(db: Session, movimentacao: Movimentacao):
    """Create new movement"""
    db.add(movimentacao)
    db.commit()
    db.refresh(movimentacao)
    return movimentacao

def obter_movimentacao_por_id(db: Session, movimentacao_id: int):
    """Get movement by ID"""
    return db.query(Movimentacao).filter(Movimentacao.id == movimentacao_id).first()

def listar_movimentacoes(db: Session, filial_id: int, skip: int = 0, limit: int = 100):
    """List movements"""
    return db.query(Movimentacao).filter(
        Movimentacao.filial_id == filial_id
    ).order_by(Movimentacao.data_movimento.desc()).offset(skip).limit(limit).all()

def listar_movimentacoes_por_tipo(
    db: Session, 
    filial_id: int, 
    tipo: str, 
    skip: int = 0, 
    limit: int = 100
):
    """List movements by type"""
    return db.query(Movimentacao).filter(
        Movimentacao.filial_id == filial_id,
        Movimentacao.tipo == tipo
    ).order_by(Movimentacao.data_movimento.desc()).offset(skip).limit(limit).all()

def atualizar_movimentacao(db: Session, movimentacao_id: int, mov_data: MovimentacaoAtualizar):
    """Update movement"""
    db_mov = obter_movimentacao_por_id(db, movimentacao_id)
    if not db_mov:
        return None
    
    update_data = mov_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_mov, field, value)
    
    db.add(db_mov)
    db.commit()
    db.refresh(db_mov)
    return db_mov

def deletar_movimentacao(db: Session, movimentacao_id: int):
    """Delete movement (soft delete)"""
    db_mov = obter_movimentacao_por_id(db, movimentacao_id)
    if db_mov:
        db.delete(db_mov)
        db.commit()
    return db_mov
