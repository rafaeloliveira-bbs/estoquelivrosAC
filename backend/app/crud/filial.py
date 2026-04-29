from sqlalchemy.orm import Session
from app.models.filial import Filial
from app.schemas.filial import FilialCriar, FilialAtualizar

def criar_filial(db: Session, filial: FilialCriar):
    """Create new branch"""
    db_filial = Filial(**filial.dict())
    db.add(db_filial)
    db.commit()
    db.refresh(db_filial)
    return db_filial

def obter_filial_por_id(db: Session, filial_id: int):
    """Get branch by ID"""
    return db.query(Filial).filter(Filial.id == filial_id).first()

def obter_filial_por_nome(db: Session, nome: str):
    """Get branch by name (case-insensitive)"""
    return db.query(Filial).filter(Filial.nome.ilike(nome.strip())).first()

def listar_filiais(db: Session, skip: int = 0, limit: int = 100):
    """List branches"""
    return db.query(Filial).offset(skip).limit(limit).all()

def atualizar_filial(db: Session, filial_id: int, filial_data: FilialAtualizar):
    """Update branch"""
    db_filial = obter_filial_por_id(db, filial_id)
    if not db_filial:
        return None
    
    update_data = filial_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_filial, field, value)
    
    db.add(db_filial)
    db.commit()
    db.refresh(db_filial)
    return db_filial

def deletar_filial(db: Session, filial_id: int):
    """Delete branch"""
    db_filial = obter_filial_por_id(db, filial_id)
    if db_filial:
        db.delete(db_filial)
        db.commit()
    return db_filial
