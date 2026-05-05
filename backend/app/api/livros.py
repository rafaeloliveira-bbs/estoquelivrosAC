import csv
import io
from decimal import Decimal
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.livro import Livro
from app.schemas.livro import LivroCriar, LivroAtualizar, LivroResposta
from app.crud.livro import (
    criar_livro, obter_livro_por_id, listar_livros,
    atualizar_livro, deletar_livro, pesquisar_livros,
    obter_livro_por_codigo, obter_livro_por_isbn,
    listar_livros_com_estoque,
)
from app.services.estoque import registrar_compra
from app.crud.filial import obter_filial_por_id, obter_filial_por_nome
from app.auth.permissions import get_current_user, requer_role
from app.config import logger
from app.utils.csv_parsing import decodificar_csv, mapear_colunas_livros, limpar_monetario

router = APIRouter(prefix="/livros", tags=["livros"])

_COLUNAS_CSV = [
    "Item", "Títulos", "Fornecedor", "Editora",
    "Classificação", "Tipo do material", "Grade", "ISBN 13", "Descontinuado?",
    "Quantidade", "Preço Unitário", "Filial",
]


@router.get("/template-csv")
async def baixar_template_csv(user=Depends(get_current_user)):
    """Retorna um arquivo CSV modelo para importação de livros e estoque."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_COLUNAS_CSV)
    writer.writeheader()
    writer.writerow({
        "Item": "1",
        "Títulos": "Exemplo de Livro",
        "Fornecedor": "Distribuidora Exemplo",
        "Editora": "Editora Exemplo",
        "Classificação": "Literatura",
        "Tipo do material": "Livro",
        "Grade": "5o Ano",
        "ISBN 13": "9788500000000",
        "Descontinuado?": "Não",
        "Quantidade": "50",
        "Preço Unitário": "25.90",
        "Filial": "",
    })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_importacao.csv"},
    )


@router.post("/preview-csv")
async def preview_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Pré-visualiza o conteúdo do CSV antes da importação."""
    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))

    fieldnames = reader.fieldnames or []

    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(row)

    column_mapping = mapear_colunas_livros(fieldnames)

    # Validar mapeamento
    warnings = []
    if not column_mapping["titulo"]:
        warnings.append("Coluna obrigatória 'Títulos' não encontrada")

    def _resolver_filial_preview(value: str):
        """Resolve filial value for preview (returns display string)."""
        if not value:
            return "(padrão: filial do usuário)"
        try:
            fid = int(value)
            filial = obter_filial_por_id(db, fid)
        except ValueError:
            filial = obter_filial_por_nome(db, value)
        if filial:
            return f"{filial.nome} (ID: {filial.id})"
        return f"Erro: '{value}' não encontrada"

    # Preparar preview dos dados mapeados
    mapped_preview = []
    for row in preview_rows:
        mapped_row = {}
        for field, col_name in column_mapping.items():
            if col_name:
                value = row.get(col_name, "")
                if field == "codigo_item":
                    try:
                        mapped_row[field] = int(value) if value else None
                    except ValueError:
                        mapped_row[field] = f"Erro: '{value}' não é numérico"
                elif field == "descontinuado":
                    val_lower = value.lower().strip()
                    mapped_row[field] = val_lower in ("sim", "yes", "true", "1", "s")
                elif field == "quantidade":
                    try:
                        mapped_row[field] = int(value) if value else None
                    except ValueError:
                        mapped_row[field] = f"Erro: '{value}' não é numérico"
                elif field == "preco_unitario":
                    try:
                        mapped_row[field] = float(value.replace(",", ".")) if value else None
                    except ValueError:
                        mapped_row[field] = f"Erro: '{value}' não é numérico"
                elif field == "filial":
                    mapped_row[field] = _resolver_filial_preview(value.strip())
                else:
                    mapped_row[field] = value
            else:
                if field == "filial":
                    mapped_row[field] = "(padrão: filial do usuário)"
                else:
                    mapped_row[field] = None
        mapped_preview.append(mapped_row)

    return {
        "fieldnames": fieldnames,
        "column_mapping": column_mapping,
        "preview_rows": preview_rows,
        "mapped_preview": mapped_preview,
        "warnings": warnings,
        "total_rows": len(preview_rows) + 1,  # +1 para cabeçalho
    }


@router.post("/importar-csv")
async def importar_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Importa livros a partir de um arquivo CSV."""
    content = await file.read()
    decoded = decodificar_csv(content)

    reader = csv.DictReader(io.StringIO(decoded))

    criados = 0
    atualizados = 0
    erros = []

    fieldnames = reader.fieldnames or []
    logger.info(f"Importação CSV - Cabeçalhos encontrados: {fieldnames}")

    col_map = mapear_colunas_livros(fieldnames)

    def _get(row, field):
        col = col_map.get(field)
        return row.get(col, "").strip() if col else ""

    def _resolver_filial(value: str, linha: int):
        """Resolve filial by ID or name. Returns (filial_id, erro_str)."""
        if not value:
            return user["filial_id"], None
        try:
            fid = int(value)
            filial = obter_filial_por_id(db, fid)
        except ValueError:
            filial = obter_filial_por_nome(db, value)
        if not filial:
            return None, f"Linha {linha}: filial '{value}' não encontrada"
        return filial.id, None

    numero_lote_base = f"IMP-{date.today().strftime('%Y%m%d')}"
    estoque_importado = 0

    for i, row in enumerate(reader, start=2):
        try:
            titulo = _get(row, "titulo")
            if not titulo:
                erros.append(f"Linha {i}: campo 'Títulos' obrigatório")
                continue

            _codigo_raw = _get(row, "codigo_item")
            logger.debug(f"Linha {i}: Tentando extrair código do item de: '{_codigo_raw}'")
            try:
                codigo_item = int(_codigo_raw) if _codigo_raw else None
            except ValueError:
                erros.append(f"Linha {i}: 'Item' deve ser numérico (recebido: '{_codigo_raw}')")
                continue

            filial_id, erro_filial = _resolver_filial(_get(row, "filial"), i)
            if erro_filial:
                erros.append(erro_filial)
                continue

            isbn_13 = _get(row, "isbn") or None
            desc_str = _get(row, "descontinuado").lower()
            descontinuado = desc_str in ("sim", "yes", "true", "1", "s")

            dados = {
                "codigo_item": codigo_item,
                "titulo": titulo,
                "fornecedor": _get(row, "fornecedor") or None,
                "editora": _get(row, "editora") or None,
                "classificacao": _get(row, "classificacao") or None,
                "tipo_material": _get(row, "tipo_material") or None,
                "grade": _get(row, "grade") or None,
                "isbn": isbn_13,
                "descontinuado": descontinuado,
                "filial_id": filial_id,
            }

            existente = None
            if codigo_item:
                existente = obter_livro_por_codigo(db, codigo_item, filial_id)
            if not existente and isbn_13:
                existente = obter_livro_por_isbn(db, isbn_13, filial_id)

            if existente:
                for k, v in dados.items():
                    setattr(existente, k, v)
                db.commit()
                atualizados += 1
                livro_id = existente.id
            else:
                livro = Livro(**dados)
                db.add(livro)
                db.commit()
                db.refresh(livro)
                criados += 1
                livro_id = livro.id

            # Registrar estoque se quantidade informada
            qtd_raw = _get(row, "quantidade")
            if qtd_raw:
                try:
                    qtd = int(qtd_raw)
                    if qtd <= 0:
                        raise ValueError("quantidade deve ser > 0")
                    preco_raw = _get(row, "preco_unitario")
                    preco = Decimal(limpar_monetario(preco_raw)) if preco_raw else Decimal("0.00")
                    numero_lote = f"{numero_lote_base}-{codigo_item or livro_id}-{i}"
                    registrar_compra(
                        db,
                        livro_id=livro_id,
                        quantidade=qtd,
                        preco_unitario=preco,
                        usuario_id=user["user_id"],
                        filial_id=filial_id,
                        numero_lote=numero_lote,
                        fornecedor=_get(row, "fornecedor") or "Importação CSV",
                    )
                    estoque_importado += 1
                except Exception as e:
                    erros.append(f"Linha {i}: erro ao registrar estoque — {str(e)}")

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(f"Importação CSV: {criados} criados, {atualizados} atualizados, {estoque_importado} estoques, {len(erros)} erros")
    return {"criados": criados, "atualizados": atualizados, "estoque_importado": estoque_importado, "erros": erros}


@router.delete("/limpar-todos")
async def limpar_todos_livros(
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    """Remove permanentemente todos os livros da filial (uso administrativo)."""
    total = db.query(Livro).filter(Livro.filial_id.in_(user["filial_ids"])).delete()
    db.commit()
    logger.warning(f"Limpeza total: {total} livros removidos da filial {user['filial_id']}")
    return {"removidos": total}


@router.post("/", response_model=LivroResposta)
async def criar_novo_livro(
    livro: LivroCriar,
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    novo_livro = criar_livro(db, livro)
    logger.info(f"Livro criado: {novo_livro.titulo}")
    return novo_livro


@router.get("/", response_model=list[LivroResposta])
async def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return listar_livros(db, filial_id=user["filial_ids"], skip=skip, limit=limit)


@router.get("/buscar", response_model=list[LivroResposta])
async def buscar(
    termo: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    livros = pesquisar_livros(db, user["filial_ids"], termo, skip, limit)
    logger.info(f"Busca: '{termo}' — {len(livros)} resultados")
    return livros


@router.get("/com-estoque")
async def listar_com_estoque(
    termo: str = Query(None),
    filial_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(2000, ge=1, le=5000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if filial_id is not None:
        if filial_id not in user["filial_ids"]:
            raise HTTPException(status_code=403, detail="Filial não autorizada")
        effective_filial = filial_id
    else:
        effective_filial = user["filial_ids"]
    return listar_livros_com_estoque(db, filial_id=effective_filial, termo=termo or None, skip=skip, limit=limit)


@router.get("/por-codigo/{codigo_item}", response_model=LivroResposta)
async def obter_por_codigo(
    codigo_item: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    livro = obter_livro_por_codigo(db, codigo_item, user["filial_ids"])
    if not livro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado")
    return livro


@router.get("/{livro_id}", response_model=LivroResposta)
async def obter(
    livro_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id not in user["filial_ids"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Livro não encontrado")
    return livro


@router.put("/{livro_id}", response_model=LivroResposta)
async def atualizar(
    livro_id: int,
    livro_data: LivroAtualizar,
    db: Session = Depends(get_db),
    user=Depends(requer_role(["gestor", "admin"])),
):
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id not in user["filial_ids"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Livro não encontrado")
    atualizado = atualizar_livro(db, livro_id, livro_data)
    logger.info(f"Livro atualizado: {livro_id}")
    return atualizado


@router.delete("/{livro_id}")
async def deletar(
    livro_id: int,
    db: Session = Depends(get_db),
    user=Depends(requer_role(["admin"])),
):
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id not in user["filial_ids"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Livro não encontrado")
    deletar_livro(db, livro_id)
    logger.info(f"Livro deletado: {livro_id}")
    return {"mensagem": "Livro deletado com sucesso"}
