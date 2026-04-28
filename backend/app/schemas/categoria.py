from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CategoriaBase(BaseModel):
    nome: str
    descricao: Optional[str] = None

class CategoriaCriar(CategoriaBase):
    pass

class CategoriaAtualizar(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None

class CategoriaResposta(CategoriaBase):
    id: int
    criado_em: datetime
    
    class Config:
        from_attributes = True
