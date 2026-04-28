#!/bin/bash

# Script de inicialização do banco de dados com dados de teste

echo "Aguardando PostgreSQL..."
while ! nc -z postgres 5432; do
  sleep 1
done

echo "Criando banco de dados..."
python -c "from app.database import init_db; init_db()"

echo "Inserindo dados de teste..."
python -c "
from app.database import SessionLocal
from app.models import Filial, Categoria, Livro, Lote, Usuario
from app.auth.jwt import hash_password
from datetime import date, datetime

db = SessionLocal()

# Create test branch
filial = Filial(
    nome='Filial Principal',
    cnpj='12.345.678/0001-00',
    endereco='Rua Principal, 123'
)
db.add(filial)
db.commit()

# Create test categories
categorias = [
    Categoria(nome='Ficção', descricao='Livros de ficção'),
    Categoria(nome='Não-Ficção', descricao='Livros de não-ficção'),
    Categoria(nome='Técnico', descricao='Livros técnicos'),
]
db.add_all(categorias)
db.commit()

# Create test user
usuario = Usuario(
    nome='Admin User',
    email='admin@estoque.com',
    senha_hash=hash_password('admin123'),
    role='admin',
    filial_id=filial.id
)
db.add(usuario)
db.commit()

# Create test books
livros = [
    Livro(
        titulo='O Senhor dos Anéis',
        autor='J.R.R. Tolkien',
        isbn='978-8533902770',
        categoria_id=categorias[0].id,
        filial_id=filial.id,
        preco_custo=80.00,
        estoque_minimo=5
    ),
    Livro(
        titulo='Sapiens',
        autor='Yuval Harari',
        isbn='978-8535914849',
        categoria_id=categorias[1].id,
        filial_id=filial.id,
        preco_custo=55.00,
        estoque_minimo=3
    ),
]
db.add_all(livros)
db.commit()

# Create test batches
lotes = [
    Lote(
        livro_id=livros[0].id,
        filial_id=filial.id,
        numero_lote='LOTE-001',
        quantidade_inicial=20,
        quantidade_disponivel=20,
        preco_custo_unitario=80.00,
        data_entrada=date.today(),
        fornecedor='Distribuidora ABC'
    ),
    Lote(
        livro_id=livros[1].id,
        filial_id=filial.id,
        numero_lote='LOTE-002',
        quantidade_inicial=15,
        quantidade_disponivel=15,
        preco_custo_unitario=55.00,
        data_entrada=date.today(),
        fornecedor='Distribuidora XYZ'
    ),
]
db.add_all(lotes)
db.commit()

print('Dados de teste inseridos com sucesso!')
print('Email de teste: admin@estoque.com')
print('Senha de teste: admin123')

db.close()
"

echo "Banco de dados inicializado com sucesso!"
