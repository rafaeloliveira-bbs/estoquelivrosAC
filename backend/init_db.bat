@echo off
REM Script de inicializacao do banco de dados para Windows

echo Criando banco de dados...
python -c "from app.database import init_db; init_db()"

echo Inserindo dados de teste...
python -c "
from app.database import SessionLocal
from app.models import Filial, Categoria, Livro, Lote, Usuario
from app.auth.jwt import hash_password
from datetime import date

db = SessionLocal()

# Criar filial de teste
filial = Filial(
    nome='Filial Principal',
    cnpj='12.345.678/0001-00',
    endereco='Rua Principal, 123'
)
db.add(filial)
db.commit()

# Criar categorias de teste
categorias = [
    Categoria(nome='Ficcao', descricao='Livros de ficcao'),
    Categoria(nome='Nao-Ficcao', descricao='Livros de nao-ficcao'),
    Categoria(nome='Tecnico', descricao='Livros tecnicos'),
]
db.add_all(categorias)
db.commit()

# Criar usuario de teste
usuario = Usuario(
    nome='Admin User',
    email='admin@estoque.com',
    senha_hash=hash_password('admin123'),
    role='admin',
    filial_id=filial.id
)
db.add(usuario)
db.commit()

print('Banco de dados inicializado com sucesso!')
print('Email: admin@estoque.com')
print('Senha: admin123')

db.close()
"

echo Concluido!
pause
