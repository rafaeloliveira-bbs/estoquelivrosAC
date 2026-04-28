# ARQUITETURA DO SISTEMA

## Visão Geral

Sistema monolítico modular de gestão de estoque de livros, otimizado para poucos usuários simultâneos e operação interna.

## Camadas da Aplicação

### 1. Camada de Apresentação (Frontend)
- **Tecnologia**: React 18 + Vite
- **Componentes**: Pages (Login, Dashboard, Movimentações)
- **State**: Zustand para autenticação
- **Comunicação**: Axios com interceptors de erro

### 2. Camada de API (Gateway)
- **Framework**: FastAPI
- **Validação**: Pydantic schemas
- **Autenticação**: JWT com HTTPBearer
- **CORS**: Configurado para múltiplas origens

### 3. Camada de Aplicação (Lógica de Negócio)
- **CRUD Operations**: Em `app/crud/`
- **Serviços**: Em `app/services/`
  - `estoque.py`: Lógica PEPS, cálculo de custo
  - `relatorios.py`: Geração de relatórios
  - `alertas.py`: Verificação de mínimos
- **Autenticação**: JWT em `app/auth/`
- **Utilitários**: Validações e formatação

### 4. Camada de Persistência
- **Banco**: PostgreSQL 15+
- **ORM**: SQLAlchemy 2.0
- **Models**: Em `app/models/`
- **Migrations**: Alembic (estrutura pronta)

## Fluxos Principais

### Fluxo de Venda (com PEPS)

```
Usuario -> Frontend -> POST /movimentacoes/venda
    |
    v
FastAPI Endpoint
    |
    v
Autenticação (JWT)
    |
    v
Service: obter_custo_medio_peps()
    |
    ├─> Buscar lotes por data_entrada (ASC)
    ├─> Somar quantidade até atingir solicitado
    └─> Retornar lista de lotes + custo
    |
    v
CRUD: criar_movimentacao() (para cada lote)
    |
    ├─> INSERT INTO movimentacao
    ├─> UPDATE lote SET quantidade_disponivel -= qtd
    └─> Trigger: INSERT INTO auditoria
    |
    v
Frontend: Exibir sucesso/erro
```

### Fluxo de Relatório

```
Usuario -> GET /relatorios/estoque-atual
    |
    v
Autenticação (JWT + filial_id)
    |
    v
Service: relatorio_estoque_atual()
    |
    ├─> SELECT livros WHERE filial_id
    ├─> Para cada livro:
    │   └─> SUM(lote.quantidade_disponivel)
    │   └─> SUM(lote.qtd * lote.preco)
    └─> Formatar resposta
    |
    v
JSON Response com estrutura definida
```

## Padrões Implementados

### Repository Pattern
```python
# app/crud/livro.py
def obter_livro_por_id(db: Session, livro_id: int):
    return db.query(Livro).filter(Livro.id == livro_id).first()
```

### Service Layer
```python
# app/services/estoque.py
def registrar_venda(db, livro_id, quantidade, usuario_id, filial_id):
    # Lógica complexa aqui
    # Usa CRUD operations
    # Gerencia transações
```

### Dependency Injection
```python
# FastAPI automático
def meu_endpoint(db: Session = Depends(get_db), user = Depends(get_current_user)):
    pass
```

### Middleware de Autenticação
```python
# Todas requisições com Authorization: Bearer {token}
@app.get("/privado")
async def privado(user = Depends(get_current_user)):
    # user = {"user_id": 1, "role": "admin", "filial_id": 1}
```

## Segurança

### Isolamento de Dados
- Cada query filtra por `filial_id` do usuário
- Usuário não pode acessar dados de outra filial
- Roles controlam permissões por endpoint

### Hash de Senhas
```python
from passlib import pwd_context
pwd_context.hash(senha)  # bcrypt
pwd_context.verify(plain, hash)
```

### Validação de Entrada
```python
class LivroCriar(BaseModel):
    titulo: str  # required
    isbn: str    # required, unique
    preco: Decimal  # type validation
```

### Auditoria
```python
# Trigger automático no PostgreSQL
CREATE TRIGGER audit_movimentacao 
AFTER INSERT ON movimentacao
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

## Performance

### Índices
- `livro(filial_id, status)` - queries frequentes
- `movimentacao(filial_id, data_movimento)`
- `isbn` - UNIQUE com index automático

### Paginação
- Todos endpoints de listagem com `skip` e `limit`
- Default: 100 itens por página
- Frontend implementa carregamento lazy

### Caching (Futuro)
- Redis para: estoque atual, top vendas, alertas
- TTL de 5 minutos para data não-crítica

## Escalabilidade

### Para 10-50 usuários (atual)
- ✅ Monolítico simples
- ✅ PostgreSQL sem replicação
- ✅ Docker em single server
- ✅ Sessões JWT com expiração

### Para 100+ usuários
- [ ] Adicionar Redis para cache
- [ ] Implementar rate limiting
- [ ] Load balancing com Nginx
- [ ] PostgreSQL connection pooling (PgBouncer)

### Para 1000+ usuários (microserviços)
- [ ] Separar: Estoque, Vendas, Auditoria
- [ ] Message queue (RabbitMQ)
- [ ] Event sourcing
- [ ] CQRS pattern

## Monitoramento

### Logs
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Venda registrada")
logger.error("Erro ao processar")
```

### Saúde da Aplicação
- `GET /health` retorna status
- `GET /docs` documentação interativa

### Métricas Futuras
- Prometheus para coleta
- Grafana para visualização
- Alertas baseados em thresholds

## Backup e Recuperação

### Estratégia
```bash
# Diário em cron
pg_dump -U postgres estoque_db > backup_$(date +%Y%m%d).sql
```

### Retenção
- Últimos 30 dias
- Upload opcional para S3

### Recuperação
```bash
psql -U postgres estoque_db < backup_20240415.sql
```

## Testing

### Estrutura
```
tests/
├── test_peps.py           # Testes FIFO
├── test_movimentacao.py   # Testes de transações
├── test_api.py            # Testes de endpoints
└── conftest.py            # Fixtures
```

### Exemplo
```python
def test_venda_peps():
    # Arrange
    livro = criar_livro_teste()
    lotes = [criar_lote_teste(...) for _ in range(3)]
    
    # Act
    resultado = registrar_venda(livro.id, quantidade=10)
    
    # Assert
    assert len(resultado["lotes_usados"]) == 1
    assert resultado["lotes_usados"][0]["lote_id"] == lotes[0].id
```

## Diagrama de Componentes

```
┌────────────────────────────┐
│    Browser / Cliente       │
└──────────────┬─────────────┘
               │ HTTPS
┌──────────────▼─────────────┐
│  FastAPI (port 8000)       │
│  - Routes                  │
│  - Middleware (Auth, CORS) │
└──────────────┬─────────────┘
               │ SQL
┌──────────────▼─────────────┐
│  SQLAlchemy ORM            │
│  - Models                  │
│  - Session management      │
└──────────────┬─────────────┘
               │ TCP:5432
┌──────────────▼─────────────┐
│  PostgreSQL 15             │
│  - Tables                  │
│  - Triggers (auditoria)    │
│  - Constraints             │
└────────────────────────────┘

┌────────────────────────────┐
│  React Frontend (port 3000)│
│  - Pages (Login, Dashboard)│
│  - Zustand (auth store)    │
│  - Axios client            │
└──────────────┬─────────────┘
               │ HTTP REST
          FastAPI API
```

## Convenções de Código

### Nomes
- `snake_case` para variáveis Python
- `PascalCase` para classes
- `UPPER_CASE` para constantes
- `camelCase` para JS/React

### Imports
```python
# System first
from datetime import datetime

# Third party
from sqlalchemy import Column, Integer
from pydantic import BaseModel

# Local
from app.models import Livro
from app.services import estoque
```

### Docstrings
```python
def registrar_venda(db, livro_id, quantidade):
    """
    Register a sale using FIFO method.
    
    Args:
        db: Database session
        livro_id: Book ID
        quantidade: Quantity to sell
        
    Returns:
        dict with status and cost info
        
    Raises:
        ValueError: If insufficient stock
    """
```

## Referências

- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- PostgreSQL: https://www.postgresql.org/docs/
- React: https://react.dev/
- JWT: https://tools.ietf.org/html/rfc7519
