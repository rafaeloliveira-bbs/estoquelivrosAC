from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Livro(Base):
    __tablename__ = "livro"
    __table_args__ = (
        UniqueConstraint("codigo_item", "filial_id", name="uq_livro_codigo_filial"),
        UniqueConstraint("isbn", "filial_id", name="uq_livro_isbn_filial"),
    )

    id = Column(Integer, primary_key=True, index=True)
    filial_id = Column(Integer, ForeignKey("filial.id"), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categoria.id"), nullable=True)

    codigo_item = Column(Integer, nullable=True, index=True)
    titulo = Column(String(255), nullable=False)
    autor = Column(String(150), nullable=True)
    isbn = Column(String(20), nullable=True, index=True)
    fornecedor = Column(String(150), nullable=True)
    editora = Column(String(150), nullable=True)
    classificacao = Column(String(100), nullable=True)
    tipo_material = Column(String(100), nullable=True)
    grade = Column(String(100), nullable=True)
    descontinuado = Column(Boolean, default=False, nullable=True)

    preco_custo = Column(Numeric(10, 2), default=0)
    estoque_minimo = Column(Integer, default=0)
    status = Column(String(20), default="ativo")

    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    filial = relationship("Filial", back_populates="livros")
    categoria = relationship("Categoria", back_populates="livros")
    lotes = relationship("Lote", back_populates="livro")
    alertas = relationship("AlertaMinimo", back_populates="livro")
