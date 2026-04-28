from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from decimal import Decimal

class LoteBase(BaseModel):
    livro_id: int
    filial_id: int
    numero_lote: str
    quantidade_inicial: int
    preco_custo_unitario: Decimal
    data_entrada: date
    fornecedor: Optional[str] = None
    validade_minima: Optional[date] = None

class LoteCriar(LoteBase):
    pass

class LoteAtualizar(BaseModel):
    numero_lote: Optional[str] = None
    quantidade_disponivel: Optional[int] = None
    preco_custo_unitario: Optional[Decimal] = None
    fornecedor: Optional[str] = None
    validade_minima: Optional[date] = None

class LoteResposta(LoteBase):
    id: int
    quantidade_disponivel: int
    criado_em: datetime
    
    class Config:
        from_attributes = True
