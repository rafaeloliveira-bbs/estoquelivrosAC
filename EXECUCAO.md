# GUIA DE EXECUÇÃO

## 1. Primeira Execução (com Docker)

### Passo 1: Clone e Configure

```bash
cd estoquelivrosAC

# Copiar arquivos de configuração
cp backend/.env.example backend/.env
```

### Passo 2: Inicie os Containers

```bash
docker-compose up -d
```

Isso vai:
- ✅ Criar container PostgreSQL
- ✅ Executar migrations automáticas
- ✅ Iniciar API FastAPI
- ✅ Iniciar Frontend React

### Passo 3: Acesse a Aplicação

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Passo 4: Login

Use as credenciais de teste:
```
Email: admin@estoque.com
Senha: admin123
```

## 2. Primeira Execução (sem Docker)

### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv

# Ativar (Windows)
venv\Scripts\activate
# OU (Linux/Mac)
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Copiar .env
cp .env.example .env

# Editar .env com suas credenciais PostgreSQL
# DATABASE_URL=postgresql://seu_user:seu_pass@localhost:5432/estoque_db

# Inicializar banco (Windows)
init_db.bat

# OU (Linux/Mac)
bash init_db.sh

# Rodar API
python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd ../frontend

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

## 3. Comandos Úteis

### Docker Compose

```bash
# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f api

# Logs específicos
docker-compose logs -f postgres

# Entrar em um container
docker-compose exec api bash
docker-compose exec postgres psql -U postgres
```

### Banco de Dados

```bash
# Conectar ao PostgreSQL
psql -U postgres -d estoque_db -h localhost

# Listar tabelas
\dt

# Ver estrutura de tabela
\d livro

# Contar registros
SELECT COUNT(*) FROM livro;

# Backup
pg_dump -U postgres estoque_db > backup.sql

# Restaurar
psql -U postgres estoque_db < backup.sql
```

### API

```bash
# Listar livros
curl -H "Authorization: Bearer {token}" http://localhost:8000/livros/

# Buscar um livro
curl http://localhost:8000/livros/1

# Obter relatório
curl -H "Authorization: Bearer {token}" http://localhost:8000/relatorios/estoque-atual
```

### Frontend

```bash
# Build para produção
npm run build

# Preview do build
npm run preview

# Lint/check
npm run lint
```

## 4. Desenvolvimento Diário

### Estrutura de Pastas

```
estoquelivrosAC/
├── backend/app/
│   ├── models/          # Modificar modelos de dados
│   ├── schemas/         # Modificar validações
│   ├── services/        # Modificar lógica de negócio
│   └── api/             # Adicionar/modificar endpoints
└── frontend/src/
    ├── pages/           # Adicionar páginas
    ├── api/             # Modificar chamadas de API
    └── store/           # Gerenciar estado
```

### Adicionar Nova Feature

#### 1. Backend: Criar novo endpoint

```python
# app/api/novo_endpoint.py
from fastapi import APIRouter, Depends
from app.auth.permissions import get_current_user

router = APIRouter(prefix="/novo", tags=["novo"])

@router.get("/")
async def obter_dados(user = Depends(get_current_user)):
    return {"dados": "aqui"}
```

#### 2. Backend: Registrar rota

```python
# app/main.py
from app.api import novo_endpoint  # Adicionar import
app.include_router(novo_endpoint.router)  # Registrar router
```

#### 3. Frontend: Adicionar chamada API

```javascript
// frontend/src/api/endpoints.js
export const novoAPI = {
  obterDados: () => apiClient.get('/novo/'),
};
```

#### 4. Frontend: Criar página

```jsx
// frontend/src/pages/NovaPagina.jsx
import { novoAPI } from '../api/endpoints';

export default function NovaPagina() {
  useEffect(() => {
    novoAPI.obterDados().then(res => {
      // Handle response
    });
  }, []);
  
  return <div>Conteúdo</div>;
}
```

#### 5. Frontend: Adicionar rota

```jsx
// frontend/src/App.jsx
import NovaPagina from './pages/NovaPagina';

<Route path="/nova" element={<PrivateRoute><NovaPagina /></PrivateRoute>} />
```

## 5. Deploying para Produção

### Opção 1: DigitalOcean / Render

```bash
# 1. Criar conta
# 2. Conectar repositório GitHub
# 3. Configurar variáveis de ambiente
# 4. Deploy automático

# Variáveis necessárias:
# DATABASE_URL
# SECRET_KEY (gere uma chave forte)
# DEBUG=False
```

### Opção 2: VPS Linux

```bash
# 1. Instalar dependências
sudo apt update
sudo apt install python3.11 postgresql nginx

# 2. Clonar repo
git clone https://github.com/seu-usuario/estoquelivrosAC

# 3. Configurar ambiente
cd estoquelivrosAC/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Configurar systemd
sudo nano /etc/systemd/system/estoque.service
# [Unit]
# Description=Estoque API
# After=network.target
#
# [Service]
# User=www-data
# WorkingDirectory=/home/app/estoquelivrosAC/backend
# ExecStart=/home/app/estoquelivrosAC/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
# Restart=always
#
# [Install]
# WantedBy=multi-user.target

# 5. Habilitar serviço
sudo systemctl enable estoque
sudo systemctl start estoque

# 6. Configurar Nginx como proxy
sudo nano /etc/nginx/sites-available/estoque
# Copiar configuração do nginx.conf

# 7. Iniciar Nginx
sudo systemctl restart nginx
```

### Opção 3: Docker em Servidor

```bash
# No servidor:
docker pull python:3.11-slim
docker pull postgres:15-alpine
docker pull node:20-alpine

# Build e run
docker-compose -f docker-compose.prod.yml up -d

# Backup automático
0 2 * * * docker exec estoque_db pg_dump -U postgres estoque_db | gzip > /backups/estoque_$(date +\%Y\%m\%d).sql.gz
```

## 6. Solução de Problemas

### API não inicia

```bash
# Verificar logs
docker-compose logs api

# Comum: Porta 8000 em uso
# Solução: mudar porta em docker-compose.yml
```

### Banco não conecta

```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Checar credenciais em .env
cat backend/.env

# Reiniciar container
docker-compose restart postgres
```

### Frontend não carrega API

```bash
# Verificar REACT_APP_API_URL
# Em docker-compose.yml, deve apontar para http://api:8000

# Verificar em localhost
# Frontend em http://localhost:3000
# API em http://localhost:8000
```

### Dados de teste não aparecem

```bash
# Recriar banco do zero
docker-compose down
docker volume rm estoque_postgres_data  # Remove dados
docker-compose up -d

# Ou executar init_db manualmente
docker-compose exec api python init_db.bat
```

## 7. Checklist de Deployment

- [ ] SECRET_KEY alterada (gerar com: `python -c "import secrets; print(secrets.token_urlsafe())"`
- [ ] DEBUG=False em produção
- [ ] DATABASE_URL aponta para produção
- [ ] CORS origins configurado corretamente
- [ ] HTTPS habilitado (usar Let's Encrypt)
- [ ] Backup automático configurado
- [ ] Logs sendo armazenados
- [ ] Monitoramento/alertas ativo
- [ ] Testes unitários passando
- [ ] Load testing realizado
- [ ] Documentação atualizada

## 8. Recursos Úteis

- **FastAPI Docs**: http://localhost:8000/docs
- **GitHub**: https://github.com/seu-usuario/estoquelivrosAC
- **Issues**: Abra issues para bugs/features
- **Discussions**: Para perguntas e ideias
