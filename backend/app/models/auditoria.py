from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Auditoria(Base):
    __tablename__ = "auditoria"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=True)
    
    tabela_afetada = Column(String(50), nullable=False)
    tipo_operacao = Column(String(20), nullable=False)  # INSERT/UPDATE/DELETE
    dados_anteriores = Column(JSON, nullable=True)
    dados_novos = Column(JSON, nullable=True)
    
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    usuario = relationship("Usuario")
