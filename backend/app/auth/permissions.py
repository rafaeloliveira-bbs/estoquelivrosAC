from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from app.auth.jwt import decode_token

# auto_error=False: permite que o cookie seja a fonte primária sem rejeitar requests sem header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def _extrair_token(request: Request, header_token: str | None) -> str | None:
    """Cookie httpOnly tem prioridade; Authorization header é fallback (Swagger)."""
    cookie = request.cookies.get("access_token")
    return cookie or header_token


async def get_current_user(
    request: Request,
    header_token: str | None = Depends(oauth2_scheme),
):
    """Extrai e valida o JWT do cookie httpOnly ou do header Authorization: Bearer."""
    token = _extrair_token(request, header_token)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "user_id": payload["user_id"],
        "role": payload["role"],
        "filial_id": payload["filial_id"],
        "filial_ids": payload["filial_ids"],
    }


def requer_role(roles_permitidos: list[str]):
    """Dependency que verifica se o usuário possui o role necessário."""
    async def verificar_role(user=Depends(get_current_user)):
        if user["role"] not in roles_permitidos and user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para acessar este recurso",
            )
        return user
    return verificar_role


def requer_admin():
    """Dependency que restringe o acesso a administradores."""
    async def verificar_admin(user=Depends(get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem acessar este recurso",
            )
        return user
    return verificar_admin
