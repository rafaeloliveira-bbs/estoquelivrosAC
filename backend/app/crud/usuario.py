from sqlalchemy.orm import Session
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCriar, UsuarioAtualizar
from app.auth.jwt import hash_password
from datetime import datetime

def criar_usuario(db: Session, usuario: UsuarioCriar):
    """Create new user"""
    db_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha_hash=hash_password(usuario.senha),
        role=usuario.role,
        filial_id=usuario.filial_id
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

def obter_usuario_por_id(db: Session, usuario_id: int):
    """Get user by ID"""
    return db.query(Usuario).filter(Usuario.id == usuario_id).first()

def obter_usuario_por_email(db: Session, email: str):
    """Get user by email"""
    return db.query(Usuario).filter(Usuario.email == email).first()

def listar_usuarios(db: Session, filial_id: int = None, skip: int = 0, limit: int = 100):
    """List users"""
    query = db.query(Usuario)
    if filial_id:
        query = query.filter(Usuario.filial_id == filial_id)
    return query.offset(skip).limit(limit).all()

def atualizar_usuario(db: Session, usuario_id: int, usuario_data: UsuarioAtualizar):
    """Update user"""
    db_usuario = obter_usuario_por_id(db, usuario_id)
    if not db_usuario:
        return None
    
    update_data = usuario_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_usuario, field, value)
    
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

def atualizar_ultimo_acesso(db: Session, usuario_id: int):
    """Update user last access time"""
    db_usuario = obter_usuario_por_id(db, usuario_id)
    if db_usuario:
        db_usuario.ultimo_acesso = datetime.utcnow()
        db.add(db_usuario)
        db.commit()
        db.refresh(db_usuario)
    return db_usuario

def deletar_usuario(db: Session, usuario_id: int):
    """Delete user (soft delete - mark as inactive)"""
    db_usuario = obter_usuario_por_id(db, usuario_id)
    if db_usuario:
        db_usuario.ativo = False
        db.add(db_usuario)
        db.commit()
    return db_usuario
