from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class MovimentacaoBase(BaseModel):
    filial_id: int
    lote_id: int
    usuario_id: int
    tipo: str  # compra/devolucao/venda/emprestimo/ajuste
    quantidade: int
    preco_unitario: Decimal
    motivo: Optional[str] = None
    documento_referencia: Optional[str] = None
    observacoes: Optional[str] = None

class MovimentacaoCriar(BaseModel):
    livro_id: int  # Para buscar o lote automaticamente
    filial_id: int
    tipo: str
    quantidade: int
    motivo: Optional[str] = None
    documento_referencia: Optional[str] = None
    observacoes: Optional[str] = None

class MovimentacaoAtualizar(BaseModel):
    motivo: Optional[str] = None
    observacoes: Optional[str] = None

class MovimentacaoResposta(MovimentacaoBase):
    id: int
    data_movimento: datetime
    criado_em: datetime
    
    class Config:
        from_attributes = True
