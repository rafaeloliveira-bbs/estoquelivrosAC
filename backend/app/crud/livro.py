from sqlalchemy.orm import Session
from sqlalchemy import cast, String, func
from app.models.livro import Livro
from app.models.lote import Lote
from app.schemas.livro import LivroCriar, LivroAtualizar

def criar_livro(db: Session, livro: LivroCriar):
    db_livro = Livro(**livro.dict())
    db.add(db_livro)
    db.commit()
    db.refresh(db_livro)
    return db_livro

def obter_livro_por_id(db: Session, livro_id: int):
    return db.query(Livro).filter(Livro.id == livro_id).first()

def obter_livro_por_isbn(db: Session, isbn: str, filial_id=None):
    q = db.query(Livro).filter(Livro.isbn == isbn)
    if filial_id is not None:
        q = q.filter(_filial_clause(Livro, filial_id))
    return q.first()

def _filial_clause(model, filial_id):
    """Suporta filial_id como int ou list[int]."""
    if isinstance(filial_id, list):
        return model.filial_id.in_(filial_id)
    return model.filial_id == filial_id


def obter_livro_por_codigo(db: Session, codigo_item: int, filial_id):
    return db.query(Livro).filter(
        Livro.codigo_item == codigo_item,
        _filial_clause(Livro, filial_id)
    ).first()

def listar_livros(db: Session, filial_id=None, skip: int = 0, limit: int = 100):
    query = db.query(Livro).filter(Livro.status == "ativo")
    if filial_id is not None:
        query = query.filter(_filial_clause(Livro, filial_id))
    return query.offset(skip).limit(limit).all()

def pesquisar_livros(db: Session, filial_id, termo: str, skip: int = 0, limit: int = 100):
    query = db.query(Livro).filter(
        _filial_clause(Livro, filial_id),
        Livro.status == "ativo"
    )
    t = f"%{termo.lower()}%"
    query = query.filter(
        Livro.titulo.ilike(t) |
        Livro.autor.ilike(t) |
        Livro.isbn.ilike(t) |
        cast(Livro.codigo_item, String).ilike(t) |
        Livro.fornecedor.ilike(t) |
        Livro.editora.ilike(t)
    )
    return query.offset(skip).limit(limit).all()

def listar_livros_com_estoque(
    db: Session, filial_id, termo: str = None, skip: int = 0, limit: int = 2000
) -> list[dict]:
    estoque_sub = (
        db.query(
            Lote.livro_id,
            func.coalesce(func.sum(Lote.quantidade_disponivel), 0).label("estoque_total"),
        )
        .filter(_filial_clause(Lote, filial_id))
        .group_by(Lote.livro_id)
        .subquery()
    )

    query = (
        db.query(Livro, func.coalesce(estoque_sub.c.estoque_total, 0).label("estoque_total"))
        .outerjoin(estoque_sub, estoque_sub.c.livro_id == Livro.id)
        .filter(_filial_clause(Livro, filial_id), Livro.status == "ativo")
    )

    if termo:
        t = f"%{termo.lower()}%"
        query = query.filter(
            Livro.titulo.ilike(t)
            | Livro.autor.ilike(t)
            | Livro.isbn.ilike(t)
            | cast(Livro.codigo_item, String).ilike(t)
            | Livro.fornecedor.ilike(t)
            | Livro.editora.ilike(t)
        )

    rows = query.order_by(Livro.codigo_item.nullsfirst(), Livro.filial_id).offset(skip).limit(limit).all()
    return [
        {
            "id": l.id,
            "codigo_item": l.codigo_item,
            "titulo": l.titulo,
            "autor": l.autor,
            "isbn": l.isbn,
            "fornecedor": l.fornecedor,
            "editora": l.editora,
            "classificacao": l.classificacao,
            "tipo_material": l.tipo_material,
            "grade": l.grade,
            "descontinuado": l.descontinuado,
            "filial_id": l.filial_id,
            "categoria_id": l.categoria_id,
            "preco_custo": float(l.preco_custo or 0),
            "estoque_minimo": l.estoque_minimo,
            "status": l.status,
            "estoque_total": int(estoque_total),
        }
        for l, estoque_total in rows
    ]


def atualizar_livro(db: Session, livro_id: int, livro_data: LivroAtualizar):
    db_livro = obter_livro_por_id(db, livro_id)
    if not db_livro:
        return None
    update_data = livro_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_livro, field, value)
    db.add(db_livro)
    db.commit()
    db.refresh(db_livro)
    return db_livro

def deletar_livro(db: Session, livro_id: int):
    db_livro = obter_livro_por_id(db, livro_id)
    if db_livro:
        db_livro.status = "inativo"
        db.add(db_livro)
        db.commit()
    return db_livro
