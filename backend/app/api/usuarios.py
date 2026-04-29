from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.usuario import UsuarioCriar, UsuarioAtualizar, UsuarioResposta
from app.crud.usuario import (
    criar_usuario, obter_usuario_por_id, listar_usuarios,
    atualizar_usuario, deletar_usuario
)
from app.auth.permissions import get_current_user, requer_admin
from app.config import logger

router = APIRouter(prefix="/usuarios", tags=["usuários"])

@router.post("/", response_model=UsuarioResposta)
async def criar_novo_usuario(
    usuario: UsuarioCriar,
    db: Session = Depends(get_db),
    user = Depends(requer_admin())
):
    """Create new user (admin only)"""
    novo_usuario = criar_usuario(db, usuario)
    logger.info(f"Novo usuário criado: {usuario.email}")
    return novo_usuario

@router.get("/", response_model=list[UsuarioResposta])
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(requer_admin())
):
    """List users"""
    usuarios = listar_usuarios(db, filial_id=user["filial_id"], skip=skip, limit=limit)
    return usuarios

@router.get("/{usuario_id}", response_model=UsuarioResposta)
async def obter(
    usuario_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get user by ID"""
    usuario = obter_usuario_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    return usuario

@router.put("/{usuario_id}", response_model=UsuarioResposta)
async def atualizar(
    usuario_id: int,
    usuario_data: UsuarioAtualizar,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Update user"""
    # Only allow users to update their own profile, or admins to update anyone
    if user["user_id"] != usuario_id and user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão"
        )
    
    usuario_atualizado = atualizar_usuario(db, usuario_id, usuario_data)
    if not usuario_atualizado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    logger.info(f"Usuário atualizado: {usuario_id}")
    return usuario_atualizado

@router.delete("/{usuario_id}")
async def deletar(
    usuario_id: int,
    db: Session = Depends(get_db),
    user = Depends(requer_admin())
):
    """Delete user (soft delete)"""
    usuario = obter_usuario_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    deletar_usuario(db, usuario_id)
    logger.info(f"Usuário deletado: {usuario_id}")
    return {"mensagem": "Usuário deletado com sucesso"}
