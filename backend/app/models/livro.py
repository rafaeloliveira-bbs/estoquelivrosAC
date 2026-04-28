from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Livro(Base):
    __tablename__ = "livro"
    
    id = Column(Integer, primary_key=True, index=True)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categoria.id"), nullable=True)
    
    titulo = Column(String(255), nullable=False)
    autor = Column(String(150), nullable=False)
    isbn = Column(String(20), unique=True, nullable=False, index=True)
    preco_custo = Column(Numeric(10, 2), default=0)
    estoque_minimo = Column(Integer, default=0)
    status = Column(String(20), default="ativo")  # ativo/inativo
    
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    filial = relationship("Filial", back_populates="livros")
    categoria = relationship("Categoria", back_populates="livros")
    lotes = relationship("Lote", back_populates="livro")
    alertas = relationship("AlertaMinimo", back_populates="livro")
