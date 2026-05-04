from sqlalchemy import Column, Integer, ForeignKey
from app.database import Base


class UsuarioFilial(Base):
    __tablename__ = "usuario_filial"

    usuario_id = Column(Integer, ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    filial_id = Column(Integer, ForeignKey("filial.id", ondelete="CASCADE"), primary_key=True)
