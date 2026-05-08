from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Movimentacao(Base):
    __tablename__ = "movimentacao"
    
    id = Column(Integer, primary_key=True, index=True)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    lote_id = Column(Integer, ForeignKey("lote.id"), nullable=True)
    livro_id = Column(Integer, ForeignKey("livro.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=False)
    
    tipo = Column(String(20), nullable=False)  # compra/devolucao/venda/emprestimo/ajuste
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(10, 2), nullable=False)
    
    motivo = Column(String(255), nullable=True)
    documento_referencia = Column(String(50), nullable=True)
    observacoes = Column(String(500), nullable=True)
    
    data_movimento = Column(DateTime, default=datetime.utcnow)
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    filial = relationship("Filial", back_populates="movimentacoes")
    lote = relationship("Lote", back_populates="movimentacoes", foreign_keys=[lote_id])
    livro = relationship("Livro", foreign_keys=[livro_id])
    usuario = relationship("Usuario", back_populates="movimentacoes")
