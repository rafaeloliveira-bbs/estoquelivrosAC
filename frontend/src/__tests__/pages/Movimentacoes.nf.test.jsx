import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Movimentacoes from '../../pages/Movimentacoes';

vi.mock('../../utils/auth', () => ({
  getUserRole: vi.fn(() => 'admin'),
}));

vi.mock('../../api/endpoints', () => ({
  movimentacoesAPI: {
    registrarVenda: vi.fn(),
    registrarCompra: vi.fn(),
    previewNfPdf: vi.fn(),
    importarNfPdf: vi.fn(),
    templateHistoricoEntradas: vi.fn(),
    previewHistoricoEntradas: vi.fn(),
    importarHistoricoEntradas: vi.fn(),
    templateHistoricoSaidas: vi.fn(),
    previewHistoricoSaidas: vi.fn(),
    importarHistoricoSaidas: vi.fn(),
    limparHistorico: vi.fn(),
  },
  livrosAPI: {
    listarComEstoque: vi.fn(),
    porCodigo: vi.fn(),
  },
  relatoriosAPI: {
    movimentacoes: vi.fn().mockResolvedValue({ data: { movimentacoes: [] } }),
  },
  filiaisAPI: {
    listar: vi.fn().mockResolvedValue({
      data: [{ id: 1, nome: 'Filial Principal' }],
    }),
  },
}));

import { movimentacoesAPI, livrosAPI } from '../../api/endpoints';

const PREVIEW_NF = {
  numero_nf: '000001',
  data: '2024-01-15',
  avisos: [],
  itens: [
    {
      titulo_nf: 'Dom Casmurro',
      match_encontrado: false,
      quantidade: 5,
      valor_unitario: 29.90,
      valor_total: 149.50,
    },
  ],
};

const PREVIEW_NF_COM_MATCH = {
  numero_nf: '000002',
  data: '2024-01-16',
  avisos: [],
  itens: [
    {
      titulo_nf: 'Dom Casmurro',
      match_encontrado: false,
      quantidade: 5,
      valor_unitario: 29.90,
      valor_total: 149.50,
    },
    {
      titulo_nf: 'Livro Já Encontrado',
      match_encontrado: true,
      livro_id: 99,
      codigo_item: 999,
      titulo_cadastro: 'Livro Cadastrado',
      quantidade: 2,
      valor_unitario: 19.90,
      valor_total: 39.80,
    },
  ],
};

// Aguarda as filiais carregarem e simula seleção de PDF
const dispararSelecaoNf = async () => {
  // Aguarda a filial aparecer no select
  await waitFor(() =>
    expect(screen.getByRole('option', { name: /filial principal/i })).toBeInTheDocument()
  );

  const selectFilial = document.querySelector('.nf-pdf-filial');
  fireEvent.change(selectFilial, { target: { value: '1' } });

  const fileInput = document.querySelector('input[accept=".pdf"]');
  const file = new File(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' });
  Object.defineProperty(fileInput, 'files', {
    value: { 0: file, length: 1, item: () => file },
    configurable: true,
  });
  fireEvent.change(fileInput);
};

describe('Movimentacoes — importação de NF (PDF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    movimentacoesAPI.previewNfPdf.mockResolvedValue({ data: PREVIEW_NF });
    livrosAPI.listarComEstoque.mockResolvedValue({ data: [] });
  });

  it('exibe barra de importação NF para usuário admin', async () => {
    render(<Movimentacoes />);
    await waitFor(() =>
      expect(screen.getByText(/importar nf/i)).toBeInTheDocument()
    );
  });

  it('exibe preview da NF após selecionar arquivo PDF', async () => {
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /nf nº 000001/i })).toBeInTheDocument()
    );
  });

  it('exibe campo de busca para item sem correspondência no cadastro', async () => {
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument()
    );
  });

  it('exibe "Nenhum item encontrado" quando nenhum livro corresponde à busca', async () => {
    livrosAPI.listarComEstoque.mockResolvedValue({ data: [] });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() => expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/pesquisar item/i), 'xyz');

    await waitFor(() =>
      expect(screen.getByText(/nenhum item encontrado/i)).toBeInTheDocument()
    );
  });

  it('não quebra ao buscar quando livro tem titulo null', async () => {
    livrosAPI.listarComEstoque.mockResolvedValue({
      data: [
        { id: 1, titulo: null, codigo_item: 1001, estoque_total: 3 },
        { id: 2, titulo: 'Livro Normal', codigo_item: 1002, estoque_total: 5 },
      ],
    });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() => expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument());

    // Não deve lançar TypeError ao buscar com titulo null na lista
    await expect(
      userEvent.type(screen.getByPlaceholderText(/pesquisar item/i), 'livro')
    ).resolves.not.toThrow();

    // O livro com titulo não-null deve aparecer
    await waitFor(() =>
      expect(screen.getByText(/livro normal/i)).toBeInTheDocument()
    );
  });

  it('busca filtra por titulo e por codigo_item', async () => {
    livrosAPI.listarComEstoque.mockResolvedValue({
      data: [
        { id: 1, titulo: 'Dom Casmurro', codigo_item: 1001, estoque_total: 5 },
        { id: 2, titulo: 'O Alquimista', codigo_item: 1002, estoque_total: 3 },
      ],
    });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() => expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/pesquisar item/i), 'dom');

    // Aguarda o dropdown aparecer com o resultado correto
    await waitFor(() =>
      expect(document.querySelector('.nf-busca-resultados')).not.toBeNull()
    );
    const dropdown = document.querySelector('.nf-busca-resultados');
    expect(dropdown.textContent).toContain('Dom Casmurro');
    expect(dropdown.textContent).not.toContain('O Alquimista');
  });

  it('selecionar livro na busca marca o item como encontrado', async () => {
    livrosAPI.listarComEstoque.mockResolvedValue({
      data: [{ id: 2, titulo: 'Dom Casmurro', codigo_item: 1001, estoque_total: 5 }],
    });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() => expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/pesquisar item/i), 'dom');

    const resultado = await screen.findByText(/1001/);
    await userEvent.click(resultado);

    // Campo de busca some e o match aparece com classe nf-match-ok
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/pesquisar item/i)).not.toBeInTheDocument()
    );
    expect(document.querySelector('.nf-match-ok')).not.toBeNull();
  });

  it('tabela NF usa classe preview-table--nf para overflow correto', async () => {
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() =>
      expect(document.querySelector('.preview-table--nf')).not.toBeNull()
    );
  });

  it('exibe item já encontrado com classe nf-match-ok', async () => {
    movimentacoesAPI.previewNfPdf.mockResolvedValue({ data: PREVIEW_NF_COM_MATCH });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() =>
      expect(document.querySelector('.nf-match-ok')).not.toBeNull()
    );
    expect(screen.getByText(/livro cadastrado/i)).toBeInTheDocument();
  });

  it('botão Cancelar fecha o preview da NF', async () => {
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /nf nº/i })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('heading', { name: /nf nº/i })).not.toBeInTheDocument();
  });

  it('não exibe mais de 10 resultados na busca', async () => {
    const muitosLivros = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      titulo: `Livro Numero ${i + 1}`,
      codigo_item: 1000 + i,
      estoque_total: 5,
    }));
    livrosAPI.listarComEstoque.mockResolvedValue({ data: muitosLivros });
    render(<Movimentacoes />);
    await dispararSelecaoNf();

    await waitFor(() => expect(screen.getByPlaceholderText(/pesquisar item/i)).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/pesquisar item/i), 'livro');

    await waitFor(() => expect(screen.getAllByText(/livro numero/i).length).toBeLessThanOrEqual(10));
  });
});
