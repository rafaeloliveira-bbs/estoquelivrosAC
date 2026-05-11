from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.services.relatorios import (
    relatorio_estoque_atual,
    relatorio_movimentacoes,
    relatorio_top_vendas,
    relatorio_alertas_minimo,
    relatorio_lotes_vencimento,
    relatorio_evolucao_estoque,
    relatorio_dashboard_por_filial,
)
from app.auth.permissions import get_current_user
from app.config import logger

router = APIRouter(prefix="/relatorios", tags=["relatórios"])

@router.get("/estoque-atual")
async def estoque_atual(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get current stock report"""
    relatorio = relatorio_estoque_atual(db, user["filial_ids"])
    logger.info(f"Relatório de estoque gerado: {len(relatorio)} itens")
    return {
        "filial_id": user["filial_id"],
        "data_geracao": date.today().isoformat(),
        "total_itens": len(relatorio),
        "total_quantidade": sum(item["quantidade_total"] for item in relatorio),
        "itens": relatorio
    }

@router.get("/movimentacoes")
async def movimentacoes(
    data_inicio: date = Query(None),
    data_fim: date = Query(None),
    tipo: str = Query(None),
    filial_id: int = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get movement report"""
    if not data_fim:
        data_fim = date.today()

    is_privileged = user["role"] in ("admin", "gestor")
    effective_filial_id = filial_id if (is_privileged and filial_id) else user["filial_ids"]

    relatorio = relatorio_movimentacoes(db, effective_filial_id, data_inicio, data_fim, tipo)
    logger.info(f"Relatório de movimentações gerado: {len(relatorio)} registros")

    return {
        "filial_id": effective_filial_id,
        "periodo": f"{data_inicio.isoformat() if data_inicio else 'início'} a {data_fim.isoformat()}",
        "total_movimentacoes": len(relatorio),
        "movimentacoes": relatorio
    }

@router.get("/top-vendas")
async def top_vendas(
    limite: int = Query(10, ge=1, le=50),
    mes: int = Query(None, ge=1, le=12),
    ano: int = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get top selling books report"""
    relatorio = relatorio_top_vendas(db, user["filial_ids"], limite, mes, ano)
    logger.info(f"Relatório de top vendas gerado: {len(relatorio)} itens")

    return {
        "filial_id": user["filial_id"],
        "periodo": f"Mês: {mes}, Ano: {ano}" if mes or ano else "Todos os períodos",
        "total_itens": len(relatorio),
        "top_vendas": relatorio
    }

@router.get("/alertas-minimo")
async def alertas_minimo(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get minimum stock alerts"""
    relatorio = relatorio_alertas_minimo(db, user["filial_ids"])
    logger.info(f"Relatório de alertas de mínimo gerado: {len(relatorio)} itens")

    return {
        "filial_id": user["filial_id"],
        "data_geracao": date.today().isoformat(),
        "total_alertas": len(relatorio),
        "alertas": relatorio
    }

@router.get("/evolucao-estoque")
async def evolucao_estoque(
    filial_id: int = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Stock evolution month by month since Dec 2024"""
    is_privileged = user["role"] in ("admin", "gestor")
    effective_filial_id = filial_id if (is_privileged and filial_id) else user["filial_ids"]
    dados = relatorio_evolucao_estoque(db, effective_filial_id)
    logger.info(f"Evolução de estoque gerada: filial={effective_filial_id}, {len(dados['itens'])} itens")
    return dados


@router.get("/dashboard-filiais")
async def dashboard_filiais(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Dashboard analytics per filial — valor, títulos, sem estoque, top por valor"""
    dados = relatorio_dashboard_por_filial(db, user["filial_ids"])
    logger.info(f"Dashboard por filial gerado: {len(dados)} filiais")
    return {"filiais": dados, "data_geracao": date.today().isoformat()}


@router.get("/lotes-vencimento")
async def lotes_vencimento(
    dias_proximos: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get expiring batches report"""
    relatorio = relatorio_lotes_vencimento(db, user["filial_ids"], dias_proximos)
    logger.info(f"Relatório de lotes com vencimento gerado: {len(relatorio)} itens")

    return {
        "filial_id": user["filial_id"],
        "dias_proximos": dias_proximos,
        "data_geracao": date.today().isoformat(),
        "total_lotes": len(relatorio),
        "lotes": relatorio
    }
