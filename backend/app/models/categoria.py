from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Categoria(Base):
    __tablename__ = "categoria"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)
    descricao = Column(String(255), nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    livros = relationship("Livro", back_populates="categoria")
