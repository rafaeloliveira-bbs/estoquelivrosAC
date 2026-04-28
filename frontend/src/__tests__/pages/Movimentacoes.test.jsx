import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Movimentacoes from '../../pages/Movimentacoes';
import { movimentacoesAPI } from '../../api/endpoints';

vi.mock('../../api/endpoints', () => ({
  movimentacoesAPI: {
    registrarVenda: vi.fn(),
    registrarCompra: vi.fn(),
  },
  livrosAPI: {},
}));

describe('Movimentacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe aba Venda selecionada por padrão', () => {
    render(<Movimentacoes />);
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Compra' })).not.toHaveClass('active');
  });

  it('troca para aba Compra ao clicar', async () => {
    render(<Movimentacoes />);
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }));
    expect(screen.getByRole('button', { name: 'Compra' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Venda' })).not.toHaveClass('active');
  });

  it('exibe campos extras de Preço, Lote e Fornecedor ao selecionar Compra', async () => {
    render(<Movimentacoes />);
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }));
    expect(screen.getByLabelText(/preço unitário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/número do lote/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fornecedor/i)).toBeInTheDocument();
  });

  it('registra venda com sucesso e limpa o formulário', async () => {
    movimentacoesAPI.registrarVenda.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();

    render(<Movimentacoes />);
    await user.type(screen.getByLabelText(/id do livro/i), '1');
    await user.type(screen.getByLabelText(/quantidade/i), '3');
    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    await waitFor(() => {
      expect(screen.getByText('Venda registrada com sucesso!')).toBeInTheDocument();
      expect(screen.getByLabelText(/id do livro/i)).toHaveValue(null);
      expect(screen.getByLabelText(/quantidade/i)).toHaveValue(null);
    });
  });

  it('registra compra com sucesso', async () => {
    movimentacoesAPI.registrarCompra.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();

    render(<Movimentacoes />);
    await user.click(screen.getByRole('button', { name: 'Compra' }));
    await user.type(screen.getByLabelText(/id do livro/i), '2');
    await user.type(screen.getByLabelText(/quantidade/i), '10');
    await user.type(screen.getByLabelText(/preço unitário/i), '50');
    await user.type(screen.getByLabelText(/número do lote/i), 'LOTE-003');
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }));

    await waitFor(() => {
      expect(screen.getByText('Compra registrada com sucesso!')).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro retornada pela API', async () => {
    movimentacoesAPI.registrarVenda.mockRejectedValueOnce({
      response: { data: { detail: 'Estoque insuficiente' } },
    });
    const user = userEvent.setup();

    render(<Movimentacoes />);
    await user.type(screen.getByLabelText(/id do livro/i), '1');
    await user.type(screen.getByLabelText(/quantidade/i), '999');
    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    await waitFor(() => {
      expect(screen.getByText('Estoque insuficiente')).toBeInTheDocument();
    });
  });
});
