from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class LivroBase(BaseModel):
    titulo: str
    autor: str
    isbn: str
    categoria_id: Optional[int] = None
    preco_custo: Decimal = 0
    estoque_minimo: int = 0
    filial_id: int

class LivroCriar(LivroBase):
    pass

class LivroAtualizar(BaseModel):
    titulo: Optional[str] = None
    autor: Optional[str] = None
    isbn: Optional[str] = None
    categoria_id: Optional[int] = None
    preco_custo: Optional[Decimal] = None
    estoque_minimo: Optional[int] = None
    status: Optional[str] = None

class LivroResposta(LivroBase):
    id: int
    status: str
    criado_em: datetime
    atualizado_em: datetime
    
    class Config:
        from_attributes = True
