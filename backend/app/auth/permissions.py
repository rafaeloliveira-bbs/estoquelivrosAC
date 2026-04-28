from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from app.auth.jwt import decode_token
from typing import Optional

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
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
        "filial_id": payload["filial_id"]
    }

def requer_role(roles_permitidos: list[str]):
    """Dependency to verify user has required role"""
    async def verificar_role(user = Depends(get_current_user)):
        if user["role"] not in roles_permitidos and user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para acessar este recurso"
            )
        return user
    return verificar_role

def requer_admin():
    """Dependency to verify user is admin"""
    async def verificar_admin(user = Depends(get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem acessar este recurso"
            )
        return user
    return verificar_admin
