from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.usuario import UsuarioCriar, UsuarioAtualizar, UsuarioResposta, UsuarioFiliaisAtualizar
from app.crud.usuario import (
    criar_usuario, obter_usuario_por_id, listar_usuarios,
    atualizar_usuario, deletar_usuario
)
from app.models.usuario_filial import UsuarioFilial
from app.models.filial import Filial
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
    if usuario.filial_id is None:
        usuario.filial_id = user["filial_id"]
    novo_usuario = criar_usuario(db, usuario)
    filiais = db.query(Filial).all()
    for f in filiais:
        db.add(UsuarioFilial(usuario_id=novo_usuario.id, filial_id=f.id))
    db.commit()
    logger.info(f"Novo usuário criado: {usuario.email} — vinculado a {len(filiais)} filial(is)")
    return novo_usuario

@router.get("/")
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(requer_admin())
):
    """List users"""
    usuarios = listar_usuarios(db, skip=skip, limit=limit)
    usuario_ids = [u.id for u in usuarios]
    filiais_map: dict[int, list[int]] = {}
    if usuario_ids:
        for r in db.query(UsuarioFilial).filter(UsuarioFilial.usuario_id.in_(usuario_ids)).all():
            filiais_map.setdefault(r.usuario_id, []).append(r.filial_id)
    result = []
    for u in usuarios:
        d = UsuarioResposta.model_validate(u).model_dump()
        d['filiais_ids'] = filiais_map.get(u.id, [u.filial_id])
        result.append(d)
    return result

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

@router.get("/{usuario_id}/filiais")
async def listar_filiais_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    user=Depends(requer_admin()),
):
    """Retorna os IDs de filiais vinculados ao usuário."""
    registros = db.query(UsuarioFilial).filter(UsuarioFilial.usuario_id == usuario_id).all()
    return [r.filial_id for r in registros]


@router.put("/{usuario_id}/filiais")
async def atualizar_filiais_usuario(
    usuario_id: int,
    body: UsuarioFiliaisAtualizar,
    db: Session = Depends(get_db),
    user=Depends(requer_admin()),
):
    """Substitui as filiais vinculadas ao usuário."""
    usuario = obter_usuario_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    if not body.filial_ids:
        raise HTTPException(status_code=400, detail="O usuário precisa ter ao menos uma filial")
    db.query(UsuarioFilial).filter(UsuarioFilial.usuario_id == usuario_id).delete()
    for fid in body.filial_ids:
        db.add(UsuarioFilial(usuario_id=usuario_id, filial_id=fid))
    db.commit()
    logger.info(f"Filiais do usuário {usuario_id} atualizadas: {body.filial_ids}")
    return {"filial_ids": body.filial_ids}


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
