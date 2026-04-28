from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class LivroBase(BaseModel):
    titulo: str
    autor: Optional[str] = None
    isbn: Optional[str] = None
    categoria_id: Optional[int] = None
    preco_custo: Decimal = Decimal("0")
    estoque_minimo: int = 0
    filial_id: int
    codigo_item: Optional[str] = None
    fornecedor: Optional[str] = None
    editora: Optional[str] = None
    classificacao: Optional[str] = None
    tipo_material: Optional[str] = None
    grade: Optional[str] = None
    descontinuado: Optional[bool] = False

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
    codigo_item: Optional[str] = None
    fornecedor: Optional[str] = None
    editora: Optional[str] = None
    classificacao: Optional[str] = None
    tipo_material: Optional[str] = None
    grade: Optional[str] = None
    descontinuado: Optional[bool] = None

class LivroResposta(LivroBase):
    id: int
    status: str
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True
