from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.livro import LivroCriar, LivroAtualizar, LivroResposta
from app.crud.livro import (
    criar_livro, obter_livro_por_id, listar_livros, 
    atualizar_livro, deletar_livro, pesquisar_livros
)
from app.auth.permissions import get_current_user, requer_role
from app.config import logger

router = APIRouter(prefix="/livros", tags=["livros"])

@router.post("/", response_model=LivroResposta)
async def criar_novo_livro(
    livro: LivroCriar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["operador", "admin"]))
):
    """Create new book"""
    novo_livro = criar_livro(db, livro)
    logger.info(f"Livro criado: {novo_livro.titulo} (ISBN: {novo_livro.isbn})")
    return novo_livro

@router.get("/", response_model=list[LivroResposta])
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """List books for user's branch"""
    livros = listar_livros(db, filial_id=user["filial_id"], skip=skip, limit=limit)
    return livros

@router.get("/buscar", response_model=list[LivroResposta])
async def buscar(
    termo: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Search books by title, author or ISBN"""
    livros = pesquisar_livros(db, user["filial_id"], termo, skip, limit)
    logger.info(f"Busca de livros: '{termo}' - {len(livros)} resultados encontrados")
    return livros

@router.get("/{livro_id}", response_model=LivroResposta)
async def obter(
    livro_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get book by ID"""
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Livro não encontrado"
        )
    return livro

@router.put("/{livro_id}", response_model=LivroResposta)
async def atualizar(
    livro_id: int,
    livro_data: LivroAtualizar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["operador", "admin"]))
):
    """Update book"""
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Livro não encontrado"
        )
    
    livro_atualizado = atualizar_livro(db, livro_id, livro_data)
    logger.info(f"Livro atualizado: {livro_id}")
    return livro_atualizado

@router.delete("/{livro_id}")
async def deletar(
    livro_id: int,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    """Delete book (soft delete)"""
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Livro não encontrado"
        )
    
    deletar_livro(db, livro_id)
    logger.info(f"Livro deletado: {livro_id}")
    return {"mensagem": "Livro deletado com sucesso"}
