from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings, logger
from app.database import get_db
from app.schemas.usuario import UsuarioLogin, TokenResposta, UsuarioResposta, UsuarioCriar, RefreshRequest
from app.crud.usuario import obter_usuario_por_email, obter_usuario_por_id, criar_usuario, atualizar_ultimo_acesso
from app.auth.jwt import verify_password, create_access_token, create_refresh_token, decode_token
from app.auth.permissions import requer_admin
from app.models.usuario_filial import UsuarioFilial
from app.models.filial import Filial

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["autenticação"])

_COOKIE_OPTS = dict(
    httponly=True,
    # SameSite=None é necessário para requests cross-origin (Vercel + backend externo);
    # requer Secure=True. Em dev (COOKIE_SECURE=False) usa Lax para funcionar sem HTTPS.
    samesite="none" if settings.COOKIE_SECURE else "lax",
    secure=settings.COOKIE_SECURE,
)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, expires_in: int):
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=expires_in,
        **_COOKIE_OPTS,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        **_COOKIE_OPTS,
    )


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

    # Admin enxerga todas as filiais; demais usuários usam a tabela UsuarioFilial
    if usuario.role == "admin":
        filial_ids = [f.id for f in db.query(Filial).all()] or [usuario.filial_id]
    else:
        registros = db.query(UsuarioFilial).filter(UsuarioFilial.usuario_id == usuario.id).all()
        if not registros:
            try:
                db.add(UsuarioFilial(usuario_id=usuario.id, filial_id=usuario.filial_id))
                db.commit()
            except Exception:
                db.rollback()
            filial_ids = [usuario.filial_id]
        else:
            filial_ids = [uf.filial_id for uf in registros]

    access_token, expires_in = create_access_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id,
        filial_ids=filial_ids,
    )
    refresh_token = create_refresh_token(
        user_id=usuario.id,
        role=usuario.role,
        filial_id=usuario.filial_id,
        filial_ids=filial_ids,
    )

    try:
        atualizar_ultimo_acesso(db, usuario.id)
    except Exception:
        logger.warning(f"Falha ao atualizar ultimo_acesso para user {usuario.id}")

    logger.info(f"User login: {usuario.email} (filial_id: {usuario.filial_id})")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        # dados públicos do usuário — o frontend armazena isso, não o JWT
        "user": {
            "id": usuario.id,
            "email": usuario.email,
            "role": usuario.role,
            "filial_id": usuario.filial_id,
            "filial_ids": filial_ids,
        },
    }


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    credenciais: UsuarioLogin,
    db: Session = Depends(get_db),
):
    """Login via JSON body. Define cookies httpOnly com os tokens."""
    dados = await _autenticar_usuario(credenciais.email, credenciais.senha, db)
    _set_auth_cookies(response, dados["access_token"], dados["refresh_token"], dados["expires_in"])
    return dados


@router.post("/token", response_model=TokenResposta)
@limiter.limit("5/minute")
async def token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login via form data — compatível com OAuth2 e o botão Authorize do Swagger."""
    dados = await _autenticar_usuario(form_data.username, form_data.password, db)
    _set_auth_cookies(response, dados["access_token"], dados["refresh_token"], dados["expires_in"])
    return dados


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    db: Session = Depends(get_db),
):
    """Renova o access token usando o refresh token (cookie ou body JSON)."""
    raw_token = request.cookies.get("refresh_token")
    if not raw_token and body:
        raw_token = body.token

    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token ausente")

    payload = decode_token(raw_token)

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

    if usuario.role == "admin":
        filial_ids = [f.id for f in db.query(Filial).all()] or [payload["filial_id"]]
    else:
        registros = db.query(UsuarioFilial).filter(UsuarioFilial.usuario_id == usuario.id).all()
        filial_ids = [uf.filial_id for uf in registros] or [payload["filial_id"]]

    access_token, expires_in = create_access_token(
        user_id=payload["user_id"],
        role=payload["role"],
        filial_id=payload["filial_id"],
        filial_ids=filial_ids,
    )

    _set_auth_cookies(response, access_token, raw_token, expires_in)

    return {
        "access_token": access_token,
        "refresh_token": raw_token,
        "expires_in": expires_in,
    }


@router.post("/logout")
async def logout(response: Response):
    """Apaga os cookies de autenticação."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"ok": True}


@router.post("/registrar", response_model=UsuarioResposta)
async def registrar(
    usuario: UsuarioCriar,
    db: Session = Depends(get_db),
    _admin=Depends(requer_admin()),
):
    """Registra novo usuário. Requer autenticação de administrador."""
    usuario_existente = obter_usuario_por_email(db, usuario.email)
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já registrado",
        )

    novo_usuario = criar_usuario(db, usuario)
    logger.info(f"New user registered: {usuario.email}")
    return novo_usuario
