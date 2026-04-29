import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, date
from app.database import get_db
from app.schemas.movimentacao import MovimentacaoCriar, MovimentacaoResposta
from app.services.estoque import registrar_venda, registrar_compra, obter_estoque_total
from app.crud.livro import obter_livro_por_id, obter_livro_por_codigo
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

@router.get("/template-estoque-csv")
async def baixar_template_estoque_csv(user=Depends(get_current_user)):
    """Retorna template CSV para importação de estoque."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["codigo_item", "quantidade", "preco_unitario"])
    writer.writeheader()
    writer.writerow({"codigo_item": "1001", "quantidade": "50", "preco_unitario": "25.90"})
    writer.writerow({"codigo_item": "1002", "quantidade": "30", "preco_unitario": "15.00"})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_estoque.csv"},
    )


@router.post("/preview-estoque-csv")
async def preview_estoque_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Pré-visualiza CSV de estoque antes de importar."""
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    rows = []
    erros = []

    for i, row in enumerate(reader, start=2):
        codigo_raw = row.get("codigo_item", "").strip()
        qtd_raw = row.get("quantidade", "").strip()
        preco_raw = row.get("preco_unitario", "").strip()

        try:
            codigo = int(codigo_raw)
        except ValueError:
            erros.append(f"Linha {i}: 'codigo_item' inválido ('{codigo_raw}')")
            continue

        try:
            qtd = int(qtd_raw)
            if qtd <= 0:
                raise ValueError
        except ValueError:
            erros.append(f"Linha {i}: 'quantidade' inválida ('{qtd_raw}')")
            continue

        preco = 0.0
        if preco_raw:
            try:
                preco = float(preco_raw.replace(",", "."))
            except ValueError:
                erros.append(f"Linha {i}: 'preco_unitario' inválido ('{preco_raw}')")
                continue

        livro = obter_livro_por_codigo(db, codigo, user["filial_id"])
        rows.append({
            "linha": i,
            "codigo_item": codigo,
            "titulo": livro.titulo if livro else "NÃO ENCONTRADO",
            "quantidade": qtd,
            "preco_unitario": preco,
            "encontrado": livro is not None,
        })

    return {"preview": rows, "erros": erros}


@router.post("/importar-estoque-csv")
async def importar_estoque_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Importa estoque a partir de CSV (codigo_item, quantidade, preco_unitario)."""
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    importados = 0
    erros = []
    numero_lote_base = f"IMP-{date.today().strftime('%Y%m%d')}"

    for i, row in enumerate(reader, start=2):
        codigo_raw = row.get("codigo_item", "").strip()
        qtd_raw = row.get("quantidade", "").strip()
        preco_raw = row.get("preco_unitario", "").strip()

        try:
            codigo = int(codigo_raw)
            qtd = int(qtd_raw)
            if qtd <= 0:
                raise ValueError("quantidade deve ser > 0")
        except ValueError as e:
            erros.append(f"Linha {i}: {e} — codigo='{codigo_raw}', qtd='{qtd_raw}'")
            continue

        preco = Decimal("0.00")
        if preco_raw:
            try:
                preco = Decimal(preco_raw.replace(",", "."))
            except Exception:
                erros.append(f"Linha {i}: preco_unitario inválido ('{preco_raw}')")
                continue

        livro = obter_livro_por_codigo(db, codigo, user["filial_id"])
        if not livro:
            erros.append(f"Linha {i}: código {codigo} não encontrado")
            continue

        try:
            numero_lote = f"{numero_lote_base}-{codigo}-{i}"
            registrar_compra(
                db,
                livro_id=livro.id,
                quantidade=qtd,
                preco_unitario=preco,
                usuario_id=user["user_id"],
                filial_id=user["filial_id"],
                numero_lote=numero_lote,
                fornecedor="Importação CSV",
            )
            importados += 1
        except Exception as e:
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(f"Importação estoque CSV: {importados} importados, {len(erros)} erros")
    return {"importados": importados, "erros": erros}


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
