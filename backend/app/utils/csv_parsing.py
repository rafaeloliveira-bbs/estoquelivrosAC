import re
import unicodedata


def limpar_monetario(raw: str) -> str:
    """Remove R$, espaços e normaliza separadores decimais/milhar para float."""
    s = re.sub(r'[Rr]\$\s*', '', raw).strip()
    if ',' in s and '.' in s:
        # formato BR: "1.234,56" → "1234.56"
        s = s.replace('.', '').replace(',', '.')
    else:
        # só vírgula decimal: "29,90" → "29.90"
        s = s.replace(',', '.')
    return s


def limpar_quantidade(raw: str) -> int:
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


def sem_acento(s: str) -> str:
    """Minúsculas sem acentos para comparação insensível a codificação."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', s.lower().strip())
        if unicodedata.category(c) != 'Mn'
    )


def decodificar_csv(content: bytes) -> str:
    """Decodifica bytes de CSV tentando UTF-8 com BOM e depois latin-1."""
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("latin-1")


def mapear_colunas_livros(fieldnames: list[str]) -> dict:
    """Mapeia cabeçalhos do CSV para campos do modelo Livro."""
    col_map = {k: None for k in (
        "codigo_item", "titulo", "fornecedor", "editora",
        "classificacao", "tipo_material", "grade",
        "isbn", "descontinuado", "quantidade", "preco_unitario", "filial",
    )}
    for col in fieldnames:
        c = col.lower().strip()
        if c in ("item", "código item", "codigo_item", "código"):
            col_map["codigo_item"] = col
        elif c in ("títulos", "titulo", "título"):
            col_map["titulo"] = col
        elif c == "fornecedor":
            col_map["fornecedor"] = col
        elif c == "editora":
            col_map["editora"] = col
        elif c in ("classificação", "classificacao"):
            col_map["classificacao"] = col
        elif c in ("tipo do material", "tipo_material", "tipo"):
            col_map["tipo_material"] = col
        elif c == "grade":
            col_map["grade"] = col
        elif c in ("isbn 13", "isbn", "isbn13"):
            col_map["isbn"] = col
        elif c in ("descontinuado?", "descontinuado"):
            col_map["descontinuado"] = col
        elif c in ("quantidade", "qtd", "qty"):
            col_map["quantidade"] = col
        elif c in ("preço unitário", "preco_unitario", "preco unitario", "preço", "preco"):
            col_map["preco_unitario"] = col
        elif c in ("filial", "filial_id", "id da filial"):
            col_map["filial"] = col
    return col_map


def mapear_colunas_historico_saidas(fieldnames: list[str]) -> dict:
    """Mapeia cabeçalhos do CSV de saídas/vendas para campos de movimentação."""
    col_map = {k: None for k in (
        "data", "observacao", "codigo_item", "titulo",
        "valor_unitario", "quantidade", "valor_total",
    )}
    for col in fieldnames:
        c = sem_acento(col)
        if c in ("data", "data saida", "data de saida", "data venda"):
            col_map["data"] = col
        elif c in ("observacoes", "observacao", "obs", "obs."):
            col_map["observacao"] = col
        elif c in ("item", "codigo do item", "codigo", "cod. item", "cod item", "codigo item"):
            col_map["codigo_item"] = col
        elif c == "titulo":
            col_map["titulo"] = col
        elif c in ("valor unit", "valor unitario", "preco unitario", "valor unit.",
                   "vl. unit.", "vlr unitario", "valor un."):
            col_map["valor_unitario"] = col
        elif c in ("qnt", "quantidade", "qtd", "qty", "qnt.", "qtde"):
            col_map["quantidade"] = col
        elif c in ("valor total", "total", "vl. total", "vlr total"):
            col_map["valor_total"] = col
    return col_map


def mapear_colunas_historico(fieldnames: list[str]) -> dict:
    """Mapeia cabeçalhos do CSV de histórico para campos de movimentação."""
    col_map = {k: None for k in (
        "data", "nf", "codigo_item", "grade", "titulo",
        "valor_unitario", "quantidade", "valor_total", "observacao",
    )}
    for col in fieldnames:
        c = sem_acento(col)
        if c in ("data", "data entrada", "data de entrada"):
            col_map["data"] = col
        elif c in ("nº nf", "n nf", "nf", "nota fiscal", "numero nf", "n da nf",
                   "num nf", "n. nf", "numero da nf", "n nota", "no nf", "nº nota"):
            col_map["nf"] = col
        elif c in ("codigo do item", "codigo", "item", "cod. item", "cod item"):
            col_map["codigo_item"] = col
        elif c == "grade":
            col_map["grade"] = col
        elif c == "titulo":
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
