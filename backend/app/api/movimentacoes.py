import csv
import io
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
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


# ─── Importação CSV – Histórico de Entradas ───────────────────────────────────

_COLUNAS_HISTORICO = [
    "Data", "Nº NF", "Código do Item", "Grade", "Título",
    "Valor Unitário", "Quantidade", "Valor Total", "Observação",
]


def _limpar_monetario(raw: str) -> str:
    """Remove R$, espaços e normaliza separadores decimais/milhar."""
    s = re.sub(r'[Rr]\$\s*', '', raw).strip()
    if ',' in s and '.' in s:
        # formato BR: "1.234,56" → "1234.56"
        s = s.replace('.', '').replace(',', '.')
    else:
        # só vírgula decimal: "29,90" → "29.90"
        s = s.replace(',', '.')
    return s


def _limpar_quantidade(raw: str) -> int:
    """Converte para int aceitando "50", "50.0", "50,0", "1.000"."""
    s = raw.strip()
    if ',' in s and '.' in s:
        last_comma, last_dot = s.rfind(','), s.rfind('.')
        if last_comma > last_dot:
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    else:
        s = s.replace(',', '.')
    return int(float(s))


def _sem_acento(s: str) -> str:
    """Minúsculas sem acentos para comparação insensível a codificação."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', s.lower().strip())
        if unicodedata.category(c) != 'Mn'
    )


def _mapear_colunas_historico(fieldnames: list[str]) -> dict:
    col_map = {k: None for k in (
        "data", "nf", "codigo_item", "grade", "titulo",
        "valor_unitario", "quantidade", "valor_total", "observacao",
    )}
    for col in fieldnames:
        c = _sem_acento(col)
        if c in ("data", "data entrada", "data de entrada"):
            col_map["data"] = col
        elif c in ("nº nf", "n nf", "nf", "nota fiscal", "numero nf", "n da nf",
                   "num nf", "n. nf", "numero da nf", "n nota", "no nf", "nº nota"):
            col_map["nf"] = col
        elif c in ("codigo do item", "codigo do item", "codigo", "item",
                   "cod. item", "cod item"):
            col_map["codigo_item"] = col
        elif c == "grade":
            col_map["grade"] = col
        elif c in ("titulo",):
            col_map["titulo"] = col
        elif c in ("valor unitario", "preco unitario", "valor unit",
                   "valor unit.", "vl. unit.", "vlr unitario", "preco unit.", "valor un."):
            col_map["valor_unitario"] = col
        elif c in ("quantidade", "qtd", "qty", "qnt", "qtde"):
            col_map["quantidade"] = col
        elif c in ("valor total", "total", "vl. total", "vlr total", "valor tot."):
            col_map["valor_total"] = col
        elif c in ("observacao", "obs", "obs.", "observacoes"):
            col_map["observacao"] = col
    return col_map


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
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = _mapear_colunas_historico(fieldnames)

    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(row)

    warnings = []
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
            elif field in ("quantidade",) and raw:
                try:
                    mapped[field] = _limpar_quantidade(raw)
                except (ValueError, ArithmeticError):
                    mapped[field] = f"Erro: '{raw}' não é numérico"
            elif field in ("valor_unitario", "valor_total") and raw:
                try:
                    mapped[field] = float(_limpar_monetario(raw))
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
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    """Importa histórico de entradas a partir de um arquivo CSV."""
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    col_map = _mapear_colunas_historico(fieldnames)
    logger.info(f"Importação histórico entradas — cabeçalhos: {fieldnames}")

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

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

            livro = obter_livro_por_codigo(db, codigo_item, user["filial_id"])
            if not livro:
                erros.append(f"Linha {i}: Item '{codigo_item}' não encontrado na filial")
                continue

            # Validações opcionais de Grade e Título
            grade_csv = _get(row, "grade")
            if grade_csv and livro.grade and grade_csv.strip().lower() != livro.grade.strip().lower():
                avisos.append(
                    f"Linha {i}: Grade do CSV ('{grade_csv}') difere do cadastro ('{livro.grade}') — importado assim mesmo"
                )

            titulo_csv = _get(row, "titulo")
            if titulo_csv and titulo_csv.strip().lower() != livro.titulo.strip().lower():
                avisos.append(
                    f"Linha {i}: Título do CSV ('{titulo_csv}') difere do cadastro ('{livro.titulo}') — importado assim mesmo"
                )

            # Data — DD/MM/AAAA (opcional; padrão: hoje)
            data_str = _get(row, "data")
            data_entrada = None
            if data_str:
                try:
                    data_entrada = datetime.strptime(data_str, "%d/%m/%Y").date()
                except ValueError:
                    erros.append(f"Linha {i}: Data inválida '{data_str}' (esperado DD/MM/AAAA)")
                    continue

            # Quantidade — obrigatório
            qtd_raw = _get(row, "quantidade")
            if not qtd_raw:
                erros.append(f"Linha {i}: 'Quantidade' é obrigatório")
                continue
            try:
                quantidade = _limpar_quantidade(qtd_raw)
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
                valor_unitario = Decimal(_limpar_monetario(valor_raw))
                if valor_unitario < 0:
                    raise InvalidOperation()
            except (InvalidOperation, Exception):
                erros.append(f"Linha {i}: Valor Unitário inválido '{valor_raw}'")
                continue

            # Nº NF → número do lote
            nf_raw = _get(row, "nf")
            numero_lote = nf_raw if nf_raw else f"{lote_base}-{i}"

            observacao = _get(row, "observacao") or None

            registrar_compra(
                db,
                livro_id=livro.id,
                quantidade=quantidade,
                preco_unitario=valor_unitario,
                usuario_id=user["user_id"],
                filial_id=user["filial_id"],
                numero_lote=numero_lote,
                data_entrada=data_entrada,
                observacoes=observacao,
            )
            importados += 1

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(
        f"Histórico entradas CSV: {importados} importados, {len(avisos)} avisos, {len(erros)} erros"
    )
    return {"importados": importados, "avisos": avisos, "erros": erros}
