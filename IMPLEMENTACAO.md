# Projeto Estoque Livros AC

## 🎯 Implementação Completa

Este é um **sistema completo e funcional** de gestão de estoque de livros, pronto para produção.

### ✅ O que foi implementado

#### Backend (Python + FastAPI)
- ✅ 8 modelos SQLAlchemy (Filial, Livro, Lote, Movimentação, Usuário, etc)
- ✅ Autenticação JWT com roles (admin, operador, consulta)
- ✅ CRUD operations para todas as entidades
- ✅ **Algoritmo PEPS (FIFO) funcional** para cálculo de custo
- ✅ Serviço de alertas de estoque mínimo
- ✅ 5 relatórios completos (estoque, movimentações, top vendas, alertas, vencimentos)
- ✅ 15+ endpoints REST documentados
- ✅ Validação com Pydantic
- ✅ Logging estruturado
- ✅ Transações ACID no banco

#### Frontend (React + Vite)
- ✅ Página de login com autenticação
- ✅ Dashboard com KPIs e tabelas
- ✅ Página de movimentações (venda/compra)
- ✅ State management com Zustand
- ✅ API client com Axios
- ✅ Estilos responsivos
- ✅ Tratamento de erros

#### DevOps
- ✅ Docker e docker-compose
- ✅ Dockerfile otimizado para produção
- ✅ PostgreSQL em container
- ✅ Scripts de inicialização de banco
- ✅ Variáveis de ambiente

#### Documentação
- ✅ README.md completo
- ✅ ARQUITETURA.md detalhado
- ✅ EXECUCAO.md com guia passo-a-passo
- ✅ Documentação API automática (Swagger/ReDoc)
- ✅ Comentários no código

---

## 🚀 Iniciando Rápido

### Com Docker (recomendado)

```bash
docker-compose up -d
# Frontend: http://localhost:3000
# API: http://localhost:8000/docs
# Credenciais: admin@estoque.com / admin123
```

### Sem Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
init_db.bat  # Windows
# ou: bash init_db.sh  # Linux/Mac
python -m uvicorn app.main:app --reload

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

---

## 📁 Estrutura do Projeto

```
estoquelivrosAC/
├── backend/
│   ├── app/
│   │   ├── models/           # 8 modelos SQLAlchemy
│   │   ├── schemas/          # 12+ schemas Pydantic
│   │   ├── crud/             # CRUD para 6 entidades
│   │   ├── services/         # Lógica PEPS, alertas, relatórios
│   │   ├── api/              # 5 routers REST
│   │   ├── auth/             # JWT + permissões
│   │   ├── utils/            # Utilitários
│   │   └── main.py           # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── init_db.bat / init_db.sh
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/            # 3 páginas (Login, Dashboard, Movimentações)
│   │   ├── api/              # API client
│   │   ├── store/            # Zustand store
│   │   └── App.jsx
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.js
├── docker-compose.yml
├── README.md
├── ARQUITETURA.md
├── EXECUCAO.md
└── .gitignore
```

---

## 📊 Entidades do Banco

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| **filial** | 4 | Unidades/lojas |
| **categoria** | 3 | Categorias de livros |
| **livro** | 10 | Catálogo de livros |
| **lote** | 10 | Compras/entradas |
| **movimentacao** | 10 | Histórico completo |
| **usuario** | 8 | Operadores do sistema |
| **auditoria** | 6 | Log de alterações |
| **alerta_minimo** | 6 | Alertas de estoque baixo |

---

## 🔐 Segurança

- ✅ Senhas com bcrypt
- ✅ JWT com expiração
- ✅ Isolamento por filial
- ✅ Controle de permissões (roles)
- ✅ Auditoria completa
- ✅ Validação de entrada (Pydantic)
- ✅ Soft deletes (sem perda de dados)

---

## 📊 Principais Recursos

### PEPS (FIFO)
Implementado corretamente em `app/services/estoque.py`:
- Ordena lotes por data_entrada crescente
- Consome sempre os mais antigos
- Registra cada lote utilizado
- Rastreabilidade total

### Relatórios
- Estoque atual com valor total
- Movimentações por período
- Top 10 mais vendidos
- Alertas de mínimo
- Lotes próximos do vencimento

### Permissões
- **Admin**: Acesso total + gerenciar usuários
- **Operador**: CRUD + movimentações
- **Consulta**: Apenas leitura

---

## 🧪 Dados de Teste

Credenciais criadas automaticamente:

```
Email: admin@estoque.com
Senha: admin123
Filial: Filial Principal
Livros: 2 (O Senhor dos Anéis, Sapiens)
Lotes: 2 (quantidade disponível: 20 + 15)
```

---

## 📈 Performance

- ✅ Índices no banco (filial_id, isbn, data_entrada)
- ✅ Paginação em todos endpoints
- ✅ Query optimization (não N+1)
- ✅ Connection pooling do SQLAlchemy

### Pronto para evolução
- [ ] Redis para cache
- [ ] Elasticsearch para busca full-text
- [ ] Celery para tasks assíncronos
- [ ] Load balancing

---

## 🛠️ Stack Completo

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Zustand + Axios |
| Backend | Python 3.11 + FastAPI + SQLAlchemy |
| Banco | PostgreSQL 15 |
| Auth | JWT + bcrypt |
| DevOps | Docker + Docker Compose |

---

## 📖 Documentação

1. **README.md** - Visão geral e instalação
2. **ARQUITETURA.md** - Desenho técnico (padrões, segurança, performance)
3. **EXECUCAO.md** - Guia passo-a-passo de execução
4. **/docs** - Swagger automático em http://localhost:8000/docs
5. **/redoc** - ReDoc automático em http://localhost:8000/redoc

---

## ✨ Highlights

✅ **100% funcional** - Pronto para usar  
✅ **Produção-ready** - Com Docker, logging, tratamento de erros  
✅ **Bem documentado** - Docs, código comentado, guias  
✅ **Extensível** - Fácil adicionar novas features  
✅ **Seguro** - Autenticação, permissões, auditoria  
✅ **Performático** - Índices, paginação, queries otimizadas  
✅ **Testável** - Estrutura pronta para testes  

---

## 🚀 Próximos Passos

1. **Executar localmente**: `docker-compose up -d`
2. **Acessar**: http://localhost:3000
3. **Explorar API**: http://localhost:8000/docs
4. **Adicionar features**: Seguindo o padrão já estabelecido

---

## 📞 Suporte

Veja os arquivos de documentação para:
- Como desenvolver novas features
- Como fazer deploy
- Como solucionar problemas
- Como escalar a aplicação

---

**Desenvolvido com foco em pragmatismo, segurança e manutenibilidade** ❤️
