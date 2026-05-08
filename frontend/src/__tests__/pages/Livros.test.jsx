import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Livros from '../../pages/Livros';

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

vi.mock('../../api/endpoints', () => ({
  livrosAPI: {
    listarComEstoque: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    baixarTemplateCSV: vi.fn(),
    importarCSV: vi.fn(),
    previewCSV: vi.fn(),
    limparTodos: vi.fn(),
  },
  categoriasAPI: { listar: vi.fn().mockResolvedValue({ data: [] }) },
  filiaisAPI: { listar: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../utils/auth', () => ({
  getUserRole: vi.fn(() => 'admin'),
  getUser: vi.fn(() => ({ filial_ids: [1] })),
}));

vi.mock('../../utils/moeda', () => ({
  parseMoeda: vi.fn((v) => parseFloat(String(v).replace(',', '.')) || 0),
  formatMoedaBR: vi.fn((v) => (v != null ? Number(v).toFixed(2).replace('.', ',') : '')),
}));

import { livrosAPI } from '../../api/endpoints';

const LIVROS_MOCK = [
  {
    id: 1, codigo_item: '1001', titulo: 'Dom Casmurro', fornecedor: 'Distribuidora X',
    editora: 'Globo', classificacao: 'Literatura', tipo_material: 'Livro', grade: '9o',
    isbn: '9780000000001', descontinuado: false, estoque_total: 5, status: 'ativo', preco_custo: 29.90,
  },
  {
    id: 2, codigo_item: '1002', titulo: 'O Alquimista', fornecedor: null, editora: null,
    classificacao: null, tipo_material: null, grade: null, isbn: null,
    descontinuado: true, estoque_total: 0, status: 'ativo', preco_custo: null,
  },
];

const renderComQuery = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Livros />
    </QueryClientProvider>
  );
};

describe('Livros — exportação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    livrosAPI.listarComEstoque.mockResolvedValue({ data: LIVROS_MOCK });
  });

  it('exibe botão Exportar na página', () => {
    renderComQuery();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument();
  });

  it('botão Exportar fica desabilitado quando não há livros', () => {
    livrosAPI.listarComEstoque.mockResolvedValue({ data: [] });
    renderComQuery();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeDisabled();
  });

  it('botão Exportar fica habilitado após carregar livros', async () => {
    renderComQuery();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled()
    );
  });

  it('abre modal de exportação ao clicar em Exportar', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    expect(screen.getByRole('heading', { name: /exportar livros/i })).toBeInTheDocument();
  });

  it('modal exibe 12 colunas todas marcadas por padrão', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(12);
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it('"Desmarcar todas" desmarca todos os checkboxes', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /desmarcar todas/i }));

    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).not.toBeChecked());
  });

  it('"Marcar todas" remarca todos os checkboxes', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /desmarcar todas/i }));
    await userEvent.click(screen.getByRole('button', { name: /^marcar todas$/i }));

    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeChecked());
  });

  it('botões XLSX e PDF ficam desabilitados quando nenhuma coluna marcada', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /desmarcar todas/i }));

    expect(screen.getByRole('button', { name: /exportar xlsx/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /exportar pdf/i })).toBeDisabled();
  });

  it('fecha modal ao clicar em Cancelar', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('heading', { name: /exportar livros/i })).not.toBeInTheDocument();
  });

  it('fecha modal ao clicar no botão ✕', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));

    const closeBtn = document.querySelector('.modal--export .btn-close');
    await userEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /exportar livros/i })).not.toBeInTheDocument();
  });

  it('modal exibe contagem de registros correta', async () => {
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));

    expect(screen.getByText(/2 registro\(s\)/)).toBeInTheDocument();
  });

  it('chama writeFile do xlsx ao exportar XLSX e fecha o modal', async () => {
    const xlsxModule = await import('xlsx');
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /exportar xlsx/i }));

    await waitFor(() => expect(xlsxModule.writeFile).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: /exportar livros/i })).not.toBeInTheDocument();
  });

  it('chama save do jsPDF ao exportar PDF e fecha o modal', async () => {
    const { default: jsPDF } = await import('jspdf');
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));
    await userEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));

    await waitFor(() => {
      const instance = jsPDF.mock.results[0]?.value;
      expect(instance?.save).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: /exportar livros/i })).not.toBeInTheDocument();
  });

  it('XLSX exporta somente as colunas selecionadas', async () => {
    const xlsxModule = await import('xlsx');
    renderComQuery();
    await waitFor(() => expect(screen.getByRole('button', { name: /exportar/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /exportar/i }));

    // Desmarca tudo e marca apenas "Título"
    await userEvent.click(screen.getByRole('button', { name: /desmarcar todas/i }));
    const checkboxTitulo = screen.getAllByRole('checkbox').find(
      (cb) => cb.closest('label')?.textContent?.trim() === 'Título'
    );
    await userEvent.click(checkboxTitulo);
    await userEvent.click(screen.getByRole('button', { name: /exportar xlsx/i }));

    await waitFor(() => expect(xlsxModule.utils.json_to_sheet).toHaveBeenCalled());
    const dadosPassados = xlsxModule.utils.json_to_sheet.mock.calls[0][0];
    // Cada linha só deve ter a chave "Título"
    dadosPassados.forEach((row) => {
      expect(Object.keys(row)).toEqual(['Título']);
    });
  });
});
