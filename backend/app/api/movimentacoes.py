from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.schemas.movimentacao import MovimentacaoCriar, MovimentacaoResposta
from app.services.estoque import registrar_venda, registrar_compra, obter_estoque_total
from app.crud.livro import obter_livro_por_id
from app.auth.permissions import get_current_user, requer_role
from app.config import logger

router = APIRouter(prefix="/movimentacoes", tags=["movimentações"])

@router.post("/venda")
async def registrar_venda_endpoint(
    livro_id: int = Query(...),
    quantidade: int = Query(..., gt=0),
    motivo: str = Query(None),
    documento_referencia: str = Query(None),
    observacoes: str = Query(None),
    db: Session = Depends(get_db),
    user = Depends(requer_role(["gestor", "admin"]))
):
    """Register a sale using FIFO method"""
    try:
        livro = obter_livro_por_id(db, livro_id)
        if not livro or livro.filial_id != user["filial_id"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Livro não encontrado"
            )
        
        resultado = registrar_venda(
            db,
            livro_id=livro_id,
            quantidade=quantidade,
            usuario_id=user["user_id"],
            filial_id=user["filial_id"],
            motivo=motivo,
            documento_referencia=documento_referencia,
            observacoes=observacoes
        )
        
        logger.info(f"Venda registrada: livro_id={livro_id}, quantidade={quantidade}, usuario_id={user['user_id']}")
        return resultado
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro ao registrar venda: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao registrar venda"
        )

@router.post("/compra")
async def registrar_compra_endpoint(
    livro_id: int = Query(...),
    quantidade: int = Query(..., gt=0),
    preco_unitario: float = Query(..., gt=0),
    numero_lote: str = Query(...),
    fornecedor: str = Query(None),
    observacoes: str = Query(None),
    db: Session = Depends(get_db),
    user = Depends(requer_role(["gestor", "admin"]))
):
    """Register a purchase (creates a new batch)"""
    try:
        livro = obter_livro_por_id(db, livro_id)
        if not livro or livro.filial_id != user["filial_id"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Livro não encontrado"
            )
        
        resultado = registrar_compra(
            db,
            livro_id=livro_id,
            quantidade=quantidade,
            preco_unitario=Decimal(str(preco_unitario)),
            usuario_id=user["user_id"],
            filial_id=user["filial_id"],
            numero_lote=numero_lote,
            fornecedor=fornecedor,
            observacoes=observacoes
        )
        
        logger.info(f"Compra registrada: livro_id={livro_id}, quantidade={quantidade}")
        return resultado
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro ao registrar compra: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao registrar compra"
        )


@router.get("/estoque/{livro_id}")
async def obter_estoque(
    livro_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get current stock for a book"""
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Livro não encontrado"
        )
    
    quantidade = obter_estoque_total(db, livro_id, user["filial_id"])
    return {
        "livro_id": livro_id,
        "titulo": livro.titulo,
        "estoque_total": quantidade,
        "estoque_minimo": livro.estoque_minimo,
        "alerta": quantidade <= livro.estoque_minimo if livro.estoque_minimo else False
    }
