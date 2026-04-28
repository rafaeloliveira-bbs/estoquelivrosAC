import csv
import io
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
)
from app.auth.permissions import get_current_user, requer_role
from app.config import logger

router = APIRouter(prefix="/livros", tags=["livros"])

_COLUNAS_CSV = [
    "codigo_item", "titulo", "fornecedor", "editora",
    "classificacao", "tipo_material", "grade", "isbn_13", "descontinuado",
]


@router.get("/template-csv")
async def baixar_template_csv(user=Depends(get_current_user)):
    """Retorna um arquivo CSV modelo para importação de livros."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_COLUNAS_CSV)
    writer.writeheader()
    writer.writerow({
        "codigo_item": "ITEM001",
        "titulo": "Exemplo de Livro",
        "fornecedor": "Distribuidora Exemplo",
        "editora": "Editora Exemplo",
        "classificacao": "Literatura",
        "tipo_material": "Livro",
        "grade": "5o Ano",
        "isbn_13": "9788500000000",
        "descontinuado": "Não",
    })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_importacao.csv"},
    )


@router.post("/importar-csv")
async def importar_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(requer_role(["operador", "admin"])),
):
    """Importa livros a partir de um arquivo CSV."""
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))

    criados = 0
    atualizados = 0
    erros = []

    for i, row in enumerate(reader, start=2):
        try:
            titulo = row.get("titulo", "").strip()
            if not titulo:
                erros.append(f"Linha {i}: campo 'titulo' obrigatório")
                continue

            codigo_item = row.get("codigo_item", "").strip() or None
            isbn_13 = row.get("isbn_13", "").strip() or None
            desc_str = row.get("descontinuado", "").strip().lower()
            descontinuado = desc_str in ("sim", "yes", "true", "1", "s")

            dados = {
                "codigo_item": codigo_item,
                "titulo": titulo,
                "fornecedor": row.get("fornecedor", "").strip() or None,
                "editora": row.get("editora", "").strip() or None,
                "classificacao": row.get("classificacao", "").strip() or None,
                "tipo_material": row.get("tipo_material", "").strip() or None,
                "grade": row.get("grade", "").strip() or None,
                "isbn": isbn_13,
                "descontinuado": descontinuado,
                "filial_id": user["filial_id"],
            }

            existente = None
            if codigo_item:
                existente = obter_livro_por_codigo(db, codigo_item, user["filial_id"])
            if not existente and isbn_13:
                existente = obter_livro_por_isbn(db, isbn_13)

            if existente:
                for k, v in dados.items():
                    setattr(existente, k, v)
                db.commit()
                atualizados += 1
            else:
                livro = Livro(**dados)
                db.add(livro)
                db.commit()
                criados += 1

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {i}: {str(e)}")

    logger.info(f"Importação CSV: {criados} criados, {atualizados} atualizados, {len(erros)} erros")
    return {"criados": criados, "atualizados": atualizados, "erros": erros}


@router.post("/", response_model=LivroResposta)
async def criar_novo_livro(
    livro: LivroCriar,
    db: Session = Depends(get_db),
    user=Depends(requer_role(["operador", "admin"])),
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
    return listar_livros(db, filial_id=user["filial_id"], skip=skip, limit=limit)


@router.get("/buscar", response_model=list[LivroResposta])
async def buscar(
    termo: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    livros = pesquisar_livros(db, user["filial_id"], termo, skip, limit)
    logger.info(f"Busca: '{termo}' — {len(livros)} resultados")
    return livros


@router.get("/{livro_id}", response_model=LivroResposta)
async def obter(
    livro_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Livro não encontrado")
    return livro


@router.put("/{livro_id}", response_model=LivroResposta)
async def atualizar(
    livro_id: int,
    livro_data: LivroAtualizar,
    db: Session = Depends(get_db),
    user=Depends(requer_role(["operador", "admin"])),
):
    livro = obter_livro_por_id(db, livro_id)
    if not livro or livro.filial_id != user["filial_id"]:
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
    if not livro or livro.filial_id != user["filial_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Livro não encontrado")
    deletar_livro(db, livro_id)
    logger.info(f"Livro deletado: {livro_id}")
    return {"mensagem": "Livro deletado com sucesso"}
