import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../../pages/Dashboard';
import { relatoriosAPI } from '../../api/endpoints';

function renderWithQuery(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.mock('../../api/endpoints', () => ({
  relatoriosAPI: {
    estoqueAtual: vi.fn(),
    alertasMinimo: vi.fn(),
  },
}));

const estoqueFixture = {
  total_itens: 2,
  itens: [
    {
      livro_id: 1,
      titulo: 'O Senhor dos Anéis',
      autor: 'Tolkien',
      isbn: '978-8533902770',
      quantidade_total: 20,
      valor_total: 1600.0,
    },
    {
      livro_id: 2,
      titulo: 'Sapiens',
      autor: 'Harari',
      isbn: '978-8535914849',
      quantidade_total: 15,
      valor_total: 825.0,
    },
  ],
};

const alertasFixture = {
  total_alertas: 1,
  alertas: [
    { livro_id: 3, titulo: 'Livro Raro', estoque_atual: 1, minimo_configurado: 5 },
  ],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe indicador de carregamento inicialmente', () => {
    relatoriosAPI.estoqueAtual.mockReturnValueOnce(new Promise(() => {}));
    relatoriosAPI.alertasMinimo.mockReturnValueOnce(new Promise(() => {}));

    renderWithQuery(<Dashboard />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renderiza itens da tabela de estoque após carregamento', async () => {
    relatoriosAPI.estoqueAtual.mockResolvedValueOnce({ data: estoqueFixture });
    relatoriosAPI.alertasMinimo.mockResolvedValueOnce({ data: { total_alertas: 0, alertas: [] } });

    renderWithQuery(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('O Senhor dos Anéis')).toBeInTheDocument();
      expect(screen.getByText('Sapiens')).toBeInTheDocument();
    });
  });

  it('exibe contador de total_itens no card de ítens', async () => {
    relatoriosAPI.estoqueAtual.mockResolvedValueOnce({ data: estoqueFixture });
    relatoriosAPI.alertasMinimo.mockResolvedValueOnce({ data: { total_alertas: 0, alertas: [] } });

    renderWithQuery(<Dashboard />);

    await waitFor(() => {
      // total_itens: 2 é renderizado no card "Total de Ítens"
      expect(screen.getByText('Total de Ítens')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('renderiza seção de alertas quando há itens abaixo do mínimo', async () => {
    relatoriosAPI.estoqueAtual.mockResolvedValueOnce({ data: estoqueFixture });
    relatoriosAPI.alertasMinimo.mockResolvedValueOnce({ data: alertasFixture });

    renderWithQuery(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Livro Raro')).toBeInTheDocument();
      expect(screen.getByText(/estoque: 1/i)).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro quando a API falha', async () => {
    relatoriosAPI.estoqueAtual.mockRejectedValueOnce(new Error('Erro de rede'));
    relatoriosAPI.alertasMinimo.mockRejectedValueOnce(new Error('Erro de rede'));

    renderWithQuery(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar dados')).toBeInTheDocument();
    });
  });
});
