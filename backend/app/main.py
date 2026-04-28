from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings, logger
from app.database import init_db
from app.api import autenticacao, livros, movimentacoes, relatorios, usuarios, categorias, filiais

# Create FastAPI app
app = FastAPI(
    title="Estoque Livros AC",
    description="Sistema de Gestão de Estoque de Livros",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(autenticacao.router)
app.include_router(livros.router)
app.include_router(movimentacoes.router)
app.include_router(relatorios.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)
app.include_router(filiais.router)

@app.on_event("startup")
async def startup_event():
    """Run on startup"""
    init_db()
    logger.info("Aplicação iniciada")
    logger.info(f"Debug mode: {settings.DEBUG}")

@app.on_event("shutdown")
async def shutdown_event():
    """Run on shutdown"""
    logger.info("Aplicação finalizada")

@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "nome": "Estoque Livros AC",
        "versao": "1.0.0",
        "status": "operacional",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health", tags=["health"])
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

@app.exception_handler(Exception)
async def exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )
