from sqlalchemy import Column, Integer, String, DateTime, CHAR
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Filial(Base):
    __tablename__ = "filial"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    cnpj = Column(String(18), unique=True, nullable=False)
    endereco = Column(String(255), nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    livros = relationship("Livro", back_populates="filial")
    lotes = relationship("Lote", back_populates="filial")
    usuarios = relationship("Usuario", back_populates="filial")
    movimentacoes = relationship("Movimentacao", back_populates="filial")
    alertas = relationship("AlertaMinimo", back_populates="filial")
