from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuario"
    
    id = Column(Integer, primary_key=True, index=True)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    
    nome = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    senha_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="gestor")  # admin/gestor
    ativo = Column(Boolean, default=True)
    
    ultimo_acesso = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    filial = relationship("Filial", back_populates="usuarios")
    movimentacoes = relationship("Movimentacao", back_populates="usuario")
