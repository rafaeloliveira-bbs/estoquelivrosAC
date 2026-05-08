import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.movimentacao import MovimentacaoCriar, MovimentacaoResposta
from app.models.movimentacao import Movimentacao
from app.services.estoque import registrar_venda, registrar_compra, obter_estoque_total
from app.crud.livro import obter_livro_por_id, obter_livro_por_codigo
from app.crud.filial import obter_filial_por_id, obter_filial_por_nome
from app.auth.permissions import get_current_user, requer_role
from app.config import logger
from app.utils.csv_parsing import (
    decodificar_csv, mapear_colunas_historico, mapear_colunas_historico_saidas,
    limpar_monetario, limpar_quantidade,
)

router = APIRouter(prefix="/movimentacoes", tags=["movimentações"])

@router.post("/venda")
async def registrar_venda_endpoint(
    livro_id: int = Query(...),
    quantidade: int = Query(..., gt=0),
    preco_unitario: float = Query(None),
    data_movimento: date = Query(None),
    motivo: str = Query(None),
    documento_referencia: str = Query(None),
    observacoes: str = Query(None),
    db: Session = Depends(get_db),
    user = Depends(requer_role(["gestor", "admin"]))
):
    """Register a sale using FIFO method"""
    try:
        livro = obter_livro_por_id(db, livro_id)
        if not livro or livro.filial_id not in user["filial_ids"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Livro não encontrado"
            )

        resultado = registrar_venda(
            db,
            livro_id=livro_id,
            quantidade=quantidade,
            usuario_id=user["user_id"],
            filial_id=livro.filial_id,
            motivo=motivo,
            documento_referencia=documento_referencia,
            observacoes=observacoes,
            preco_venda=Decimal(str(preco_unitario)) if preco_unitario is not None else None,
            data_venda=data_movimento,
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
    numero_lote: str = Query(None),
    data_entrada: date = Query(None),
    fornecedor: str = Query(None),
    observacoes: str = Query(None),
    db: Session = Depends(get_db),
    user = Depends(requer_role(["gestor", "admin"]))
):
    """Register a purchase (creates a new batch)"""
    try:
        livro = obter_livro_por_id(db, livro_id)
        if not livro or livro.filial_id not in user["filial_ids"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Livro não encontrado"
            )

        lote = numero_lote or f"LC-{(data_entrada or date.today()).strftime('%Y%m%d')}-{livro_id}"
        resultado = registrar_compra(
            db,
            livro_id=livro_id,
            quantidade=quantidade,
            preco_unitario=Decimal(str(preco_unitario)),
            usuario_id=user["user_id"],
            filial_id=livro.filial_id,
            numero_lote=lote,
            data_entrada=data_entrada,
            fornecedor=fornecedor,
            observacoes=observacoes,
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
    if not livro or livro.filial_id not in user["filial_ids"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Livro não encontrado"
        )

    quantidade = obter_estoque_total(db, livro_id, livro.filial_id)
    return {
        "livro_id": livro_id,
        "titulo": livro.titulo,
        "estoque_total": quantidade,
        "estoque_minimo": livro.estoque_minimo,
        "alerta": quantidade <= livro.estoque_minimo if livro.estoque_minimo else False
    }


# ─── Importação CSV – Histórico de Entradas ───────────────────────────────────

_COLUNAS_HISTORICO = [
    "Data", "Nº NF", "Código do Item", "Grade", "Título",
    "Valor Unitário", "Quantidade", "Valor Total", "Observação",
]




@router.get("/historico-entradas/template-csv")
async def template_historico_entradas_csv(user=Depends(get_current_user)):
    """Retorna o modelo CSV para importação do histórico de entradas."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_COLUNAS_HISTORICO)
    writer.writeheader()
    writer.writerow({
        "Data": "15/03/2024",
        "Nº NF": "12345",
        "Código do Item": "1001",
        "Grade": "5o Ano",
        "Título": "Exemplo de Livro",
        "Valor Unitário": "29.90",
        "Quantidade": "50",
        "Valor Total": "1495.00",
        "Observação": "",
    })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_historico_entradas.csv"},
    )


@router.post("/historico-entradas/preview-csv")
async def preview_historico_entradas_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    """Pré-visualiza o CSV de histórico de entradas antes da importação."""
    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = mapear_colunas_historico(fieldnames)

    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(row)

    warnings = []
    if not col_map["data"]:
        warnings.append("Coluna obrigatória 'Data' não encontrada — a importação falhará sem ela")
    if not col_map["codigo_item"]:
        warnings.append("Coluna obrigatória 'Código do Item' não encontrada")
    if not col_map["quantidade"]:
        warnings.append("Coluna obrigatória 'Quantidade' não encontrada")
    if not col_map["valor_unitario"]:
        warnings.append("Coluna obrigatória 'Valor Unitário' não encontrada")

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

    mapped_preview = []
    for row in preview_rows:
        mapped = {}
        for field in ("data", "nf", "codigo_item", "grade", "titulo",
                      "valor_unitario", "quantidade", "valor_total", "observacao"):
            raw = _get(row, field)  # filial_id comes from UI selector, not CSV
            if field == "data" and raw:
                try:
                    datetime.strptime(raw, "%d/%m/%Y")
                    mapped[field] = raw
                except ValueError:
                    mapped[field] = f"Erro: '{raw}' inválido (esperado DD/MM/AAAA)"
            elif field == "codigo_item" and raw:
                try:
                    mapped[field] = int(raw)
                except ValueError:
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            elif field in ("quantidade",) and raw:
                try:
                    mapped[field] = limpar_quantidade(raw)
                except (ValueError, ArithmeticError):
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            elif field in ("valor_unitario", "valor_total") and raw:
                try:
                    mapped[field] = float(limpar_monetario(raw))
                except (ValueError, InvalidOperation):
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            else:
                mapped[field] = raw or None
        mapped_preview.append(mapped)

    return {
        "fieldnames": fieldnames,
        "column_mapping": col_map,
        "preview_rows": preview_rows,
        "mapped_preview": mapped_preview,
        "warnings": warnings,
        "total_rows": len(preview_rows),
    }


@router.post("/historico-entradas/importar-csv")
async def importar_historico_entradas_csv(
    filial_id: int = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    """Importa histórico de entradas a partir de um arquivo CSV. filial_id escolhido na UI."""
    filial_id_efetivo = filial_id if filial_id is not None else user["filial_id"]

    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = mapear_colunas_historico(fieldnames)
    logger.info(f"Importação histórico entradas — filial={filial_id_efetivo}, cabeçalhos: {fieldnames}")

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

    def _normalizar(s: str) -> str:
        import unicodedata
        return ' '.join(unicodedata.normalize('NFKC', s).split()).lower()

    importados = 0
    avisos: list[str] = []
    erros: list[str] = []
    lote_base = f"ENT-{date.today().strftime('%Y%m%d')}"

    for i, row in enumerate(reader, start=2):
        try:
            # Código do Item — obrigatório
            codigo_raw = _get(row, "codigo_item")
            if not codigo_raw:
                erros.append(f"Linha {i}: 'Código do Item' é obrigatório")
                continue
            try:
                codigo_item = int(codigo_raw)
            except ValueError:
                erros.append(f"Linha {i}: 'Código do Item' deve ser numérico (recebido: '{codigo_raw}')")
                continue

            livro = obter_livro_por_codigo(db, codigo_item, filial_id_efetivo)
            if not livro:
                erros.append(f"Linha {i}: Item '{codigo_item}' não encontrado na filial {filial_id_efetivo}")
                continue

            # Validações opcionais de Grade e Título
            grade_csv = _get(row, "grade")
            if grade_csv and livro.grade and _normalizar(grade_csv) != _normalizar(livro.grade):
                avisos.append(
                    f"Linha {i}: Grade do CSV ('{grade_csv}') difere do cadastro ('{livro.grade}') — importado assim mesmo"
                )

            titulo_csv = _get(row, "titulo")
            if titulo_csv and _normalizar(titulo_csv) != _normalizar(livro.titulo):
                avisos.append(
                    f"Linha {i}: Título do CSV ('{titulo_csv}') difere do cadastro ('{livro.titulo}') — importado assim mesmo"
                )

            # Data — obrigatório
            data_str = _get(row, "data")
            if not data_str:
                erros.append(f"Linha {i}: 'Data' é obrigatório")
                continue
            data_entrada = None
            for _fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
                try:
                    data_entrada = datetime.strptime(data_str.strip(), _fmt).date()
                    break
                except ValueError:
                    continue
            if data_entrada is None:
                erros.append(f"Linha {i}: Data inválida '{data_str}' (esperado DD/MM/AAAA)")
                continue

            # Quantidade — obrigatório
            qtd_raw = _get(row, "quantidade")
            if not qtd_raw:
                erros.append(f"Linha {i}: 'Quantidade' é obrigatório")
                continue
            try:
                quantidade = limpar_quantidade(qtd_raw)
                if quantidade <= 0:
                    raise ValueError()
            except (ValueError, ArithmeticError):
                erros.append(f"Linha {i}: Quantidade inválida '{qtd_raw}' (deve ser inteiro > 0)")
                continue

            # Valor Unitário — obrigatório
            valor_raw = _get(row, "valor_unitario")
            if not valor_raw:
                erros.append(f"Linha {i}: 'Valor Unitário' é obrigatório")
                continue
            try:
                valor_unitario = Decimal(limpar_monetario(valor_raw))
                if valor_unitario < 0:
                    raise InvalidOperation()
            except (InvalidOperation, Exception):
                erros.append(f"Linha {i}: Valor Unitário inválido '{valor_raw}'")
                continue

            nf_raw = _get(row, "nf")
            observacao = _get(row, "observacao") or None

            data_mov = datetime.combine(data_entrada, datetime.min.time())
            mov = Movimentacao(
                filial_id=filial_id_efetivo,
                livro_id=livro.id,
                lote_id=None,
                usuario_id=user["user_id"],
                tipo="compra",
                quantidade=quantidade,
                preco_unitario=valor_unitario,
                documento_referencia=nf_raw or None,
                observacoes=observacao,
                data_movimento=data_mov,
            )
            db.add(mov)
            db.commit()
            importados += 1

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(
        f"Histórico entradas CSV: {importados} importados, {len(avisos)} avisos, {len(erros)} erros"
    )
    return {"importados": importados, "avisos": avisos, "erros": erros}


# ─── Importação CSV – Histórico de Saídas ────────────────────────────────────

_COLUNAS_HISTORICO_SAIDAS = [
    "Data", "Observações", "Item", "Título", "Valor Unit", "Qnt", "Valor Total",
]


@router.get("/historico-saidas/template-csv")
async def template_historico_saidas_csv(user=Depends(get_current_user)):
    """Retorna o modelo CSV para importação do histórico de saídas (vendas)."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_COLUNAS_HISTORICO_SAIDAS)
    writer.writeheader()
    writer.writerow({
        "Data": "15/03/2024",
        "Observações": "",
        "Item": "1001",
        "Título": "Exemplo de Livro",
        "Valor Unit": "39.90",
        "Qnt": "10",
        "Valor Total": "399.00",
    })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_historico_saidas.csv"},
    )


@router.post("/historico-saidas/preview-csv")
async def preview_historico_saidas_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    """Pré-visualiza o CSV de histórico de saídas antes da importação."""
    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = mapear_colunas_historico_saidas(fieldnames)

    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(row)

    warnings = []
    if not col_map["data"]:
        warnings.append("Coluna obrigatória 'Data' não encontrada — a importação falhará sem ela")
    if not col_map["codigo_item"]:
        warnings.append("Coluna obrigatória 'Item' não encontrada")
    if not col_map["quantidade"]:
        warnings.append("Coluna obrigatória 'Qnt' não encontrada")
    if not col_map["valor_unitario"]:
        warnings.append("Coluna obrigatória 'Valor Unit' não encontrada")

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

    mapped_preview = []
    for row in preview_rows:
        mapped = {}
        for field in ("data", "observacao", "codigo_item", "titulo",
                      "valor_unitario", "quantidade", "valor_total"):
            raw = _get(row, field)
            if field == "data" and raw:
                try:
                    datetime.strptime(raw, "%d/%m/%Y")
                    mapped[field] = raw
                except ValueError:
                    mapped[field] = f"Erro: '{raw}' inválido (esperado DD/MM/AAAA)"
            elif field == "codigo_item" and raw:
                try:
                    mapped[field] = int(raw)
                except ValueError:
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            elif field == "quantidade" and raw:
                try:
                    mapped[field] = limpar_quantidade(raw)
                except (ValueError, ArithmeticError):
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            elif field in ("valor_unitario", "valor_total") and raw:
                try:
                    mapped[field] = float(limpar_monetario(raw))
                except (ValueError, InvalidOperation):
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            else:
                mapped[field] = raw or None
        mapped_preview.append(mapped)

    return {
        "fieldnames": fieldnames,
        "column_mapping": col_map,
        "mapped_preview": mapped_preview,
        "warnings": warnings,
        "total_rows": len(preview_rows),
    }


@router.post("/historico-saidas/importar-csv")
async def importar_historico_saidas_csv(
    filial_id: int = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    """Importa histórico de saídas (vendas). filial_id escolhido na UI."""
    filial_id_efetivo = filial_id if filial_id is not None else user["filial_id"]

    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = mapear_colunas_historico_saidas(fieldnames)
    logger.info(f"Importação histórico saídas — filial={filial_id_efetivo}, cabeçalhos: {fieldnames}")

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

    def _normalizar(s: str) -> str:
        import unicodedata
        return ' '.join(unicodedata.normalize('NFKC', s).split()).lower()

    importados = 0
    avisos: list[str] = []
    erros: list[str] = []

    for i, row in enumerate(reader, start=2):
        try:
            # Item (código) — obrigatório
            codigo_raw = _get(row, "codigo_item")
            if not codigo_raw:
                erros.append(f"Linha {i}: 'Item' é obrigatório")
                continue
            try:
                codigo_item = int(codigo_raw)
            except ValueError:
                erros.append(f"Linha {i}: 'Item' deve ser numérico (recebido: '{codigo_raw}')")
                continue

            livro = obter_livro_por_codigo(db, codigo_item, filial_id_efetivo)
            if not livro:
                erros.append(f"Linha {i}: Item '{codigo_item}' não encontrado na filial {filial_id_efetivo}")
                continue

            # Validação opcional de título
            titulo_csv = _get(row, "titulo")
            if titulo_csv and _normalizar(titulo_csv) != _normalizar(livro.titulo):
                avisos.append(
                    f"Linha {i}: Título do CSV ('{titulo_csv}') difere do cadastro ('{livro.titulo}') — importado assim mesmo"
                )

            # Data — obrigatório
            data_str = _get(row, "data")
            if not data_str:
                erros.append(f"Linha {i}: 'Data' é obrigatório")
                continue
            data_venda = None
            for _fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
                try:
                    data_venda = datetime.strptime(data_str.strip(), _fmt).date()
                    break
                except ValueError:
                    continue
            if data_venda is None:
                erros.append(f"Linha {i}: Data inválida '{data_str}' (esperado DD/MM/AAAA)")
                continue

            # Qnt — obrigatório
            qtd_raw = _get(row, "quantidade")
            if not qtd_raw:
                erros.append(f"Linha {i}: 'Qnt' é obrigatório")
                continue
            try:
                quantidade = limpar_quantidade(qtd_raw)
                if quantidade <= 0:
                    raise ValueError()
            except (ValueError, ArithmeticError):
                erros.append(f"Linha {i}: Quantidade inválida '{qtd_raw}' (deve ser inteiro > 0)")
                continue

            # Valor Unit — obrigatório
            valor_raw = _get(row, "valor_unitario")
            if not valor_raw:
                erros.append(f"Linha {i}: 'Valor Unit' é obrigatório")
                continue
            try:
                valor_unitario = Decimal(limpar_monetario(valor_raw))
                if valor_unitario < 0:
                    raise InvalidOperation()
            except (InvalidOperation, Exception):
                erros.append(f"Linha {i}: Valor Unit inválido '{valor_raw}'")
                continue

            observacao = _get(row, "observacao") or None

            data_mov = datetime.combine(data_venda, datetime.min.time())
            mov = Movimentacao(
                filial_id=filial_id_efetivo,
                livro_id=livro.id,
                lote_id=None,
                usuario_id=user["user_id"],
                tipo="venda",
                quantidade=quantidade,
                preco_unitario=valor_unitario,
                observacoes=observacao,
                data_movimento=data_mov,
            )
            db.add(mov)
            db.commit()
            importados += 1

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(
        f"Histórico saídas CSV: {importados} importados, {len(avisos)} avisos, {len(erros)} erros"
    )
    return {"importados": importados, "avisos": avisos, "erros": erros}


# ─── Limpeza de Histórico Importado ──────────────────────────────────────────

@router.delete("/historico")
async def limpar_historico(
    filial_id: int = Query(None),
    tipo: str = Query(None, description="'entradas', 'saidas' ou omitir para ambos"),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Remove registros históricos importados via CSV (lote_id = NULL) da filial.
    Movimentações regulares (compras/vendas com lote vinculado) NÃO são afetadas."""
    filial_id_efetivo = filial_id if filial_id is not None else user["filial_id"]

    query = db.query(Movimentacao).filter(
        Movimentacao.filial_id == filial_id_efetivo,
        Movimentacao.lote_id == None,
    )
    if tipo == "entradas":
        query = query.filter(Movimentacao.tipo == "compra")
    elif tipo == "saidas":
        query = query.filter(Movimentacao.tipo == "venda")

    removidos = query.delete(synchronize_session=False)
    db.commit()
    logger.info(f"Histórico limpo: {removidos} registros removidos (filial={filial_id_efetivo}, tipo={tipo})")
    return {"removidos": removidos}
