from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.usuario import UsuarioLogin, TokenResposta, UsuarioResposta, UsuarioCriar
from app.crud.usuario import obter_usuario_por_email, obter_usuario_por_id, criar_usuario, atualizar_ultimo_acesso
from app.auth.jwt import verify_password, create_access_token, create_refresh_token, decode_token
from app.config import logger

router = APIRouter(prefix="/auth", tags=["autenticação"])

@router.post("/login", response_model=TokenResposta)
async def login(credenciais: UsuarioLogin, db: Session = Depends(get_db)):
    """User login endpoint"""
    usuario = obter_usuario_por_email(db, credenciais.email)
    
    if not usuario:
        logger.warning(f"Login attempt com email inexistente: {credenciais.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário desativado"
        )
    
    if not verify_password(credenciais.senha, usuario.senha_hash):
        logger.warning(f"Login attempt com senha incorreta: {credenciais.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    # Update last access
    atualizar_ultimo_acesso(db, usuario.id)
    
    # Create tokens
    access_token, expires_in = create_access_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id
    )
    refresh_token = create_refresh_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id
    )
    
    logger.info(f"User login: {usuario.email} (filial_id: {usuario.filial_id})")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in
    }

@router.post("/refresh", response_model=TokenResposta)
async def refresh(token: str, db: Session = Depends(get_db)):
    """Refresh access token"""
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    usuario = obter_usuario_por_id(db, payload["user_id"])
    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou desativado"
        )
    access_token, expires_in = create_access_token(
        user_id=payload["user_id"],
        role=payload["role"],
        filial_id=payload["filial_id"]
    )
    
    return {
        "access_token": access_token,
        "refresh_token": token,
        "expires_in": expires_in
    }

@router.post("/registrar", response_model=UsuarioResposta)
async def registrar(usuario: UsuarioCriar, db: Session = Depends(get_db)):
    """Register new user (admin only - pode ser removido para production)"""
    usuario_existente = obter_usuario_por_email(db, usuario.email)
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já registrado"
        )
    
    novo_usuario = criar_usuario(db, usuario)
    logger.info(f"New user registered: {usuario.email}")
    return novo_usuario
