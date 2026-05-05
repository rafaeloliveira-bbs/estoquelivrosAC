import pytest
from app.utils.csv_parsing import (
    limpar_monetario,
    limpar_quantidade,
    sem_acento,
    decodificar_csv,
    mapear_colunas_livros,
    mapear_colunas_historico,
    mapear_colunas_historico_saidas,
)


class TestLimparMonetario:
    def test_ponto_decimal(self):
        assert limpar_monetario("29.90") == "29.90"

    def test_virgula_decimal(self):
        assert limpar_monetario("29,90") == "29.90"

    def test_formato_br_milhar(self):
        assert limpar_monetario("1.234,56") == "1234.56"

    def test_simbolo_real(self):
        assert limpar_monetario("R$ 29,90") == "29.90"

    def test_simbolo_real_maiusculo(self):
        assert limpar_monetario("R$1.234,56") == "1234.56"

    def test_espacos(self):
        assert limpar_monetario("  29,90  ") == "29.90"

    def test_numero_inteiro(self):
        assert limpar_monetario("100") == "100"


class TestLimparQuantidade:
    def test_inteiro(self):
        assert limpar_quantidade("50") == 50

    def test_decimal_ponto(self):
        assert limpar_quantidade("50.0") == 50

    def test_decimal_virgula(self):
        assert limpar_quantidade("50,0") == 50

    def test_milhar_br_com_virgula(self):
        # "1.500,0" — ambos separadores presentes: vírgula é decimal, ponto é milhar
        assert limpar_quantidade("1.500,0") == 1500

    def test_milhar_br_inteiro(self):
        assert limpar_quantidade("2.500,0") == 2500

    def test_ponto_sem_virgula_interpretado_como_decimal(self):
        # "1.000" sem vírgula: ambíguo; a função trata ponto como decimal → 1
        # Use "1.000,0" para milhar inequívoco em formato BR
        assert limpar_quantidade("1.000") == 1


class TestSemAcento:
    def test_acento_agudo(self):
        assert sem_acento("Título") == "titulo"

    def test_cedilha(self):
        assert sem_acento("Classificação") == "classificacao"

    def test_maiusculas(self):
        assert sem_acento("TÍTULO") == "titulo"

    def test_espacos(self):
        assert sem_acento("  abc  ") == "abc"


class TestDecodificarCsv:
    def test_utf8(self):
        content = "Título,Autor\n".encode("utf-8")
        assert "Título" in decodificar_csv(content)

    def test_utf8_bom(self):
        content = "Título,Autor\n".encode("utf-8-sig")
        decoded = decodificar_csv(content)
        assert decoded.startswith("Título")

    def test_latin1(self):
        content = "Preço\n".encode("latin-1")
        assert "Pre" in decodificar_csv(content)


class TestMapearColunasLivros:
    def test_colunas_padrao(self):
        headers = ["Item", "Títulos", "Fornecedor", "Editora",
                   "Classificação", "Tipo do material", "Grade",
                   "ISBN 13", "Descontinuado?", "Quantidade", "Preço Unitário", "Filial"]
        m = mapear_colunas_livros(headers)
        assert m["codigo_item"] == "Item"
        assert m["titulo"] == "Títulos"
        assert m["isbn"] == "ISBN 13"
        assert m["quantidade"] == "Quantidade"
        assert m["preco_unitario"] == "Preço Unitário"

    def test_colunas_alternativas(self):
        headers = ["codigo_item", "titulo", "isbn", "qtd", "preco"]
        m = mapear_colunas_livros(headers)
        assert m["codigo_item"] == "codigo_item"
        assert m["titulo"] == "titulo"
        assert m["isbn"] == "isbn"
        assert m["quantidade"] == "qtd"
        assert m["preco_unitario"] == "preco"

    def test_coluna_ausente(self):
        m = mapear_colunas_livros(["Fornecedor"])
        assert m["titulo"] is None
        assert m["fornecedor"] == "Fornecedor"


class TestMapearColunasHistorico:
    def test_colunas_padrao(self):
        headers = ["Data", "Nº NF", "Código do Item", "Grade",
                   "Título", "Valor Unitário", "Quantidade", "Valor Total", "Observação"]
        m = mapear_colunas_historico(headers)
        assert m["data"] == "Data"
        assert m["nf"] == "Nº NF"
        assert m["codigo_item"] == "Código do Item"
        assert m["valor_unitario"] == "Valor Unitário"
        assert m["quantidade"] == "Quantidade"

    def test_alias_nf(self):
        m = mapear_colunas_historico(["Nota Fiscal"])
        assert m["nf"] == "Nota Fiscal"


class TestMapearColunasHistoricoSaidas:
    def test_colunas_padrao(self):
        headers = ["Data", "Observações", "Item", "Título", "Valor Unit", "Qnt", "Valor Total"]
        m = mapear_colunas_historico_saidas(headers)
        assert m["data"] == "Data"
        assert m["codigo_item"] == "Item"
        assert m["valor_unitario"] == "Valor Unit"
        assert m["quantidade"] == "Qnt"
