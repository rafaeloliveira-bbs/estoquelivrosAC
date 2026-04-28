from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.schemas.usuario import UsuarioLogin, TokenResposta, UsuarioResposta, UsuarioCriar, RefreshRequest
from app.crud.usuario import obter_usuario_por_email, obter_usuario_por_id, criar_usuario, atualizar_ultimo_acesso
from app.auth.jwt import verify_password, create_access_token, create_refresh_token, decode_token
from app.config import logger

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["autenticação"])


async def _autenticar_usuario(email: str, senha: str, db: Session) -> dict:
    """Valida credenciais e retorna tokens."""
    usuario = obter_usuario_por_email(db, email)

    if not usuario:
        logger.warning(f"Login attempt com email inexistente: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário desativado",
        )

    if not verify_password(senha, usuario.senha_hash):
        logger.warning(f"Login attempt com senha incorreta: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    # Tokens gerados antes de qualquer escrita opcional no banco
    access_token, expires_in = create_access_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id,
    )
    refresh_token = create_refresh_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id,
    )

    # Atualização não-crítica: falha não bloqueia o login
    try:
        atualizar_ultimo_acesso(db, usuario.id)
    except Exception:
        logger.warning(f"Falha ao atualizar ultimo_acesso para user {usuario.id}")

    logger.info(f"User login: {usuario.email} (filial_id: {usuario.filial_id})")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
    }


@router.post("/login", response_model=TokenResposta)
@limiter.limit("5/minute")
async def login(request: Request, credenciais: UsuarioLogin, db: Session = Depends(get_db)):
    """Login via JSON body."""
    return await _autenticar_usuario(credenciais.email, credenciais.senha, db)


@router.post("/token", response_model=TokenResposta)
@limiter.limit("5/minute")
async def token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login via form data — compatível com OAuth2 e o botão Authorize do Swagger."""
    return await _autenticar_usuario(form_data.username, form_data.password, db)


@router.post("/refresh", response_model=TokenResposta)
async def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Renova o access token usando o refresh token no body JSON."""
    payload = decode_token(body.token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    usuario = obter_usuario_por_id(db, payload["user_id"])
    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou desativado",
        )

    access_token, expires_in = create_access_token(
        user_id=payload["user_id"],
        role=payload["role"],
        filial_id=payload["filial_id"],
    )

    return {
        "access_token": access_token,
        "refresh_token": body.token,
        "expires_in": expires_in,
    }


@router.post("/registrar", response_model=UsuarioResposta)
async def registrar(usuario: UsuarioCriar, db: Session = Depends(get_db)):
    """Registra novo usuário (remover em produção)."""
    usuario_existente = obter_usuario_por_email(db, usuario.email)
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já registrado",
        )

    novo_usuario = criar_usuario(db, usuario)
    logger.info(f"New user registered: {usuario.email}")
    return novo_usuario
