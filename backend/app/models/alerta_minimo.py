from sqlalchemy import Column, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class AlertaMinimo(Base):
    __tablename__ = "alerta_minimo"
    
    id = Column(Integer, primary_key=True, index=True)
    livro_id = Column(Integer, ForeignKey("livro.id"), nullable=False)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    
    quantidade_atual = Column(Integer, nullable=False)
    minimo_configurado = Column(Integer, nullable=False)
    ativo = Column(Boolean, default=True)
    
    criado_em = Column(DateTime, default=datetime.utcnow)
    verificado_em = Column(DateTime, nullable=True)
    
    # Relationships
    livro = relationship("Livro", back_populates="alertas")
    filial = relationship("Filial", back_populates="alertas")
