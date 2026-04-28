from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from app.config import settings, logger
from app.database import init_db
from app.api import autenticacao, livros, movimentacoes, relatorios, usuarios, categorias, filiais

app = FastAPI(
    title="Bright — Estoque de Livros",
    description="Sistema de Gestão de Estoque de Livros",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(autenticacao.router)
app.include_router(livros.router)
app.include_router(movimentacoes.router)
app.include_router(relatorios.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)
app.include_router(filiais.router)


def _migrar_colunas_livro():
    """Adiciona colunas novas à tabela livro se ainda não existirem."""
    from sqlalchemy import text
    from app.database import engine, _is_sqlite
    novas_colunas = [
        ("codigo_item", "VARCHAR(50)"),
        ("fornecedor", "VARCHAR(150)"),
        ("editora", "VARCHAR(150)"),
        ("classificacao", "VARCHAR(100)"),
        ("tipo_material", "VARCHAR(100)"),
        ("grade", "VARCHAR(100)"),
        ("descontinuado", "BOOLEAN DEFAULT FALSE"),
    ]
    with engine.connect() as conn:
        for col, tipo in novas_colunas:
            try:
                if _is_sqlite:
                    conn.execute(text(f"ALTER TABLE livro ADD COLUMN {col} {tipo}"))
                else:
                    conn.execute(text(f"ALTER TABLE livro ADD COLUMN IF NOT EXISTS {col} {tipo}"))
                conn.commit()
            except Exception:
                conn.rollback()
        if not _is_sqlite:
            for col in ("isbn", "autor"):
                try:
                    conn.execute(text(f"ALTER TABLE livro ALTER COLUMN {col} DROP NOT NULL"))
                    conn.commit()
                except Exception:
                    conn.rollback()


@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        _migrar_colunas_livro()
    except Exception as e:
        logger.error(f"init_db falhou: {e}")
    if settings.SECRET_KEY == "dev-insecure-change-in-production":
        logger.warning("ATENÇÃO: SECRET_KEY padrão em uso — altere antes de ir para produção!")
    logger.info("Aplicação iniciada")
    logger.info(f"Debug mode: {settings.DEBUG}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Aplicação finalizada")


@app.get("/", tags=["root"])
async def root():
    return {
        "nome": "Estoque Livros AC",
        "versao": "1.0.0",
        "status": "operacional",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


@app.get("/debug-db", tags=["health"])
async def debug_db():
    from sqlalchemy import text
    from app.database import engine
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()")).fetchone()
            return {"db": "ok", "version": str(result[0])}
    except Exception as e:
        return {"db": "erro", "detail": str(e)}


# Handler específico para HTTPException — garante que 401/403/400 não virem 500
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc: HTTPException):
    return await http_exception_handler(request, exc)


# Handler genérico apenas para exceções não tratadas
@app.exception_handler(Exception)
async def exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )
