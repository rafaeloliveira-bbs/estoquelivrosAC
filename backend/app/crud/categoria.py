from sqlalchemy.orm import Session
from app.models.categoria import Categoria
from app.schemas.categoria import CategoriaCriar, CategoriaAtualizar

def criar_categoria(db: Session, categoria: CategoriaCriar):
    """Create new category"""
    db_categoria = Categoria(**categoria.dict())
    db.add(db_categoria)
    db.commit()
    db.refresh(db_categoria)
    return db_categoria

def obter_categoria_por_id(db: Session, categoria_id: int):
    """Get category by ID"""
    return db.query(Categoria).filter(Categoria.id == categoria_id).first()

def listar_categorias(db: Session, skip: int = 0, limit: int = 100):
    """List categories"""
    return db.query(Categoria).offset(skip).limit(limit).all()

def atualizar_categoria(db: Session, categoria_id: int, categoria_data: CategoriaAtualizar):
    """Update category"""
    db_categoria = obter_categoria_por_id(db, categoria_id)
    if not db_categoria:
        return None
    
    update_data = categoria_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_categoria, field, value)
    
    db.add(db_categoria)
    db.commit()
    db.refresh(db_categoria)
    return db_categoria

def deletar_categoria(db: Session, categoria_id: int):
    """Delete category"""
    db_categoria = obter_categoria_por_id(db, categoria_id)
    if db_categoria:
        db.delete(db_categoria)
        db.commit()
    return db_categoria
