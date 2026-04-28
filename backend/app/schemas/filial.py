from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FilialBase(BaseModel):
    nome: str
    cnpj: str
    endereco: Optional[str] = None

class FilialCriar(FilialBase):
    pass

class FilialAtualizar(BaseModel):
    nome: Optional[str] = None
    endereco: Optional[str] = None

class FilialResposta(FilialBase):
    id: int
    criado_em: datetime
    
    class Config:
        from_attributes = True
