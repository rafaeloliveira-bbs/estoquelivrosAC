from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.livro import Livro
from app.schemas.livro import LivroCriar, LivroAtualizar

def criar_livro(db: Session, livro: LivroCriar):
    """Create new book"""
    db_livro = Livro(**livro.dict())
    db.add(db_livro)
    db.commit()
    db.refresh(db_livro)
    return db_livro

def obter_livro_por_id(db: Session, livro_id: int):
    """Get book by ID"""
    return db.query(Livro).filter(Livro.id == livro_id).first()

def obter_livro_por_isbn(db: Session, isbn: str):
    """Get book by ISBN"""
    return db.query(Livro).filter(Livro.isbn == isbn).first()

def listar_livros(db: Session, filial_id: int = None, skip: int = 0, limit: int = 100):
    """List books"""
    query = db.query(Livro).filter(Livro.status == "ativo")
    if filial_id:
        query = query.filter(Livro.filial_id == filial_id)
    return query.offset(skip).limit(limit).all()

def pesquisar_livros(db: Session, filial_id: int, termo: str, skip: int = 0, limit: int = 100):
    """Search books by title, author or ISBN"""
    query = db.query(Livro).filter(
        Livro.filial_id == filial_id,
        Livro.status == "ativo"
    )
    
    termo_lower = f"%{termo.lower()}%"
    query = query.filter(
        (Livro.titulo.ilike(termo_lower)) |
        (Livro.autor.ilike(termo_lower)) |
        (Livro.isbn.ilike(termo_lower))
    )
    
    return query.offset(skip).limit(limit).all()

def atualizar_livro(db: Session, livro_id: int, livro_data: LivroAtualizar):
    """Update book"""
    db_livro = obter_livro_por_id(db, livro_id)
    if not db_livro:
        return None
    
    update_data = livro_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_livro, field, value)
    
    db.add(db_livro)
    db.commit()
    db.refresh(db_livro)
    return db_livro

def deletar_livro(db: Session, livro_id: int):
    """Delete book (soft delete - mark as inactive)"""
    db_livro = obter_livro_por_id(db, livro_id)
    if db_livro:
        db_livro.status = "inativo"
        db.add(db_livro)
        db.commit()
    return db_livro
