from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.auth.jwt import decode_token

# tokenUrl aponta para o endpoint OAuth2-compatível que o Swagger Authorize usa
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Extrai e valida o JWT do header Authorization: Bearer."""
    payload = decode_token(token)

    if payload is None:
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
