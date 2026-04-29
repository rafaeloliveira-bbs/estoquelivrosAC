from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    role: str = "gestor"
    filial_id: int

class UsuarioCriar(UsuarioBase):
    senha: str
    filial_id: Optional[int] = None

class UsuarioAtualizar(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    ativo: Optional[bool] = None
    senha: Optional[str] = None

class UsuarioResposta(UsuarioBase):
    id: int
    ativo: bool
    ultimo_acesso: Optional[datetime] = None
    criado_em: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str

class TokenResposta(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class RefreshRequest(BaseModel):
    token: str
