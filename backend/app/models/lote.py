from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Lote(Base):
    __tablename__ = "lote"
    
    id = Column(Integer, primary_key=True, index=True)
    livro_id = Column(Integer, ForeignKey("livro.id"), nullable=False)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    
    numero_lote = Column(String(50), nullable=False)
    quantidade_inicial = Column(Integer, nullable=False)
    quantidade_disponivel = Column(Integer, nullable=False)
    preco_custo_unitario = Column(Numeric(10, 2), nullable=False)
    
    data_entrada = Column(Date, nullable=False)
    fornecedor = Column(String(150), nullable=True)
    validade_minima = Column(Date, nullable=True)
    
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    livro = relationship("Livro", back_populates="lotes")
    filial = relationship("Filial", back_populates="lotes")
    movimentacoes = relationship("Movimentacao", back_populates="lote")
