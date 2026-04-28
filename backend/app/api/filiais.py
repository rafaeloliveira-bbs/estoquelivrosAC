from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.filial import FilialCriar, FilialAtualizar, FilialResposta
from app.crud.filial import (
    criar_filial, obter_filial_por_id,
    listar_filiais, atualizar_filial, deletar_filial
)
from app.auth.permissions import get_current_user, requer_role
from app.config import logger

router = APIRouter(prefix="/filiais", tags=["filiais"])

@router.get("/", response_model=list[FilialResposta])
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    return listar_filiais(db, skip=skip, limit=limit)

@router.post("/", response_model=FilialResposta)
async def criar(
    filial: FilialCriar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    nova = criar_filial(db, filial)
    logger.info(f"Filial criada: {nova.nome}")
    return nova

@router.get("/{filial_id}", response_model=FilialResposta)
async def obter(
    filial_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    filial = obter_filial_por_id(db, filial_id)
    if not filial:
        raise HTTPException(status_code=404, detail="Filial não encontrada")
    return filial

@router.put("/{filial_id}", response_model=FilialResposta)
async def atualizar(
    filial_id: int,
    filial_data: FilialAtualizar,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    filial = atualizar_filial(db, filial_id, filial_data)
    if not filial:
        raise HTTPException(status_code=404, detail="Filial não encontrada")
    return filial

@router.delete("/{filial_id}")
async def deletar(
    filial_id: int,
    db: Session = Depends(get_db),
    user = Depends(requer_role(["admin"]))
):
    filial = deletar_filial(db, filial_id)
    if not filial:
        raise HTTPException(status_code=404, detail="Filial não encontrada")
    logger.info(f"Filial deletada: {filial_id}")
    return {"mensagem": "Filial deletada com sucesso"}
