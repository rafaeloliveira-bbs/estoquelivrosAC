import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from datetime import date


def _make_lote(id, quantidade, preco, data=None):
    lote = MagicMock()
    lote.id = id
    lote.quantidade_disponivel = quantidade
    lote.preco_custo_unitario = Decimal(str(preco))
    lote.data_entrada = data or date(2024, 1, id)
    return lote


class TestObterCustoMedioPeps:
    """Testa o cálculo FIFO de custo."""

    def _run(self, lotes, quantidade):
        from app.services.estoque import obter_custo_medio_peps
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = lotes
        return obter_custo_medio_peps(db, livro_id=1, filial_id=1, quantidade_solicitada=quantidade)

    def test_lote_unico_completo(self):
        lotes = [_make_lote(1, 10, "20.00")]
        result = self._run(lotes, 5)
        assert result["custo_total"] == 100.0
        assert result["preco_unitario_medio"] == 20.0
        assert len(result["lotes_usados"]) == 1
        assert result["lotes_usados"][0]["quantidade"] == 5

    def test_fifo_dois_lotes(self):
        # Lote mais antigo: 5 unidades a R$10; mais novo: 10 a R$20
        lotes = [
            _make_lote(1, 5, "10.00", date(2024, 1, 1)),
            _make_lote(2, 10, "20.00", date(2024, 2, 1)),
        ]
        result = self._run(lotes, 8)
        # FIFO: 5 do lote 1 (R$50) + 3 do lote 2 (R$60) = R$110
        assert result["custo_total"] == pytest.approx(110.0)
        assert len(result["lotes_usados"]) == 2
        assert result["lotes_usados"][0]["quantidade"] == 5
        assert result["lotes_usados"][1]["quantidade"] == 3

    def test_preco_medio_fifo(self):
        lotes = [
            _make_lote(1, 10, "10.00"),
            _make_lote(2, 10, "30.00"),
        ]
        result = self._run(lotes, 20)
        # (10*10 + 10*30) / 20 = 400 / 20 = 20
        assert result["preco_unitario_medio"] == pytest.approx(20.0)

    def test_estoque_insuficiente(self):
        lotes = [_make_lote(1, 3, "10.00")]
        with pytest.raises(ValueError, match="Estoque insuficiente"):
            self._run(lotes, 10)

    def test_sem_estoque(self):
        with pytest.raises(ValueError):
            self._run([], 1)

    def test_lote_unico_quantidade_exata(self):
        lotes = [_make_lote(1, 5, "15.00")]
        result = self._run(lotes, 5)
        assert result["custo_total"] == 75.0
        assert result["lotes_usados"][0]["quantidade"] == 5


class TestObterEstoqueTotal:
    def test_soma_lotes(self):
        from app.services.estoque import obter_estoque_total
        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 42
        assert obter_estoque_total(db, livro_id=1, filial_id=1) == 42

    def test_sem_lotes(self):
        from app.services.estoque import obter_estoque_total
        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = None
        assert obter_estoque_total(db, livro_id=1, filial_id=1) == 0
