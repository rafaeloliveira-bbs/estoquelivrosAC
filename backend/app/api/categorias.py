from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.categoria import CategoriaCriar, CategoriaAtualizar, CategoriaResposta
from app.crud.categoria import (
    criar_categoria, obter_categoria_por_id,
    listar_categorias, atualizar_categoria, deletar_categoria
)
from app.auth.permissions import get_current_user, requer_role
from app.config import logger

router = APIRouter(prefix="/categorias", tags=["categorias"])

@router.get("/", response_model=list[CategoriaResposta])
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    return listar_categorias(db, skip=skip, limit=limit)

@router.post("/", response_model=CategoriaResposta)
async def criar(
    categoria: CategoriaCriar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    nova = criar_categoria(db, categoria)
    logger.info(f"Categoria criada: {nova.nome}")
    return nova

@router.get("/{categoria_id}", response_model=CategoriaResposta)
async def obter(
    categoria_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    cat = obter_categoria_por_id(db, categoria_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return cat

@router.put("/{categoria_id}", response_model=CategoriaResposta)
async def atualizar(
    categoria_id: int,
    categoria_data: CategoriaAtualizar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    cat = atualizar_categoria(db, categoria_id, categoria_data)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return cat

@router.delete("/{categoria_id}")
async def deletar(
    categoria_id: int,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    cat = deletar_categoria(db, categoria_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    logger.info(f"Categoria deletada: {categoria_id}")
    return {"mensagem": "Categoria deletada com sucesso"}
