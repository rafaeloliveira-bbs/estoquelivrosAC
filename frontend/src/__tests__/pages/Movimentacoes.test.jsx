import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Movimentacoes from '../../pages/Movimentacoes';

// vi.mock é hoisted — não pode referenciar variáveis definidas no módulo
vi.mock('../../api/endpoints', () => ({
  movimentacoesAPI: {
    registrarVenda: vi.fn(),
    registrarCompra: vi.fn(),
  },
  livrosAPI: {
    listarComEstoque: vi.fn().mockResolvedValue({ data: [] }),
    porCodigo: vi.fn().mockResolvedValue({ data: { id: 1, titulo: 'Livro Teste', grade: '5o', codigo_item: 1001 } }),
  },
  filiaisAPI: { listar: vi.fn().mockResolvedValue({ data: [] }) },
}));

import { movimentacoesAPI, livrosAPI } from '../../api/endpoints';
const LIVRO_MOCK = { id: 1, titulo: 'Livro Teste', grade: '5o', codigo_item: 1001 };

describe('Movimentacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    livrosAPI.porCodigo.mockResolvedValue({ data: LIVRO_MOCK });
  });

  it('exibe seção Registrar ativa por padrão com formulários de Compra e Venda', () => {
    render(<Movimentacoes />);
    // A aba ativa tem classe "active"
    const abaRegistrar = screen.getAllByRole('button').find(
      (btn) => btn.textContent.trim() === 'Registrar'
    );
    expect(abaRegistrar).toHaveClass('active');
    expect(screen.getByRole('heading', { name: /compra/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /venda/i })).toBeInTheDocument();
  });

  it('exibe botões de submit corretos em cada formulário', () => {
    render(<Movimentacoes />);
    expect(screen.getByRole('button', { name: /registrar compra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar venda/i })).toBeInTheDocument();
  });

  it('troca para seção Histórico ao clicar na aba', async () => {
    render(<Movimentacoes />);
    const abaHistorico = screen.getAllByRole('button').find(
      (btn) => btn.textContent.trim() === 'Histórico'
    );
    await userEvent.click(abaHistorico);
    expect(abaHistorico).toHaveClass('active');
    expect(screen.queryByRole('heading', { name: /compra/i })).not.toBeInTheDocument();
  });

  it('registra compra com sucesso e exibe mensagem', async () => {
    movimentacoesAPI.registrarCompra.mockResolvedValueOnce({ data: {} });
    render(<Movimentacoes />);

    // Preenche o código do item (primeiro campo "Ex: 1001")
    const [inputCodigoCompra] = screen.getAllByPlaceholderText('Ex: 1001');
    await userEvent.type(inputCodigoCompra, '1001');
    fireEvent.blur(inputCodigoCompra); // dispara lookup

    await waitFor(() => expect(livrosAPI.porCodigo).toHaveBeenCalled());

    // Valor unitário e quantidade no form de compra
    const [inputValorCompra] = screen.getAllByPlaceholderText('0,00');
    await userEvent.type(inputValorCompra, '29,90');
    const [inputQtdCompra] = screen.getAllByRole('spinbutton');
    await userEvent.type(inputQtdCompra, '10');

    await userEvent.click(screen.getByRole('button', { name: /registrar compra/i }));

    await waitFor(() => {
      expect(screen.getByText('Compra registrada com sucesso!')).toBeInTheDocument();
    });
  });

  it('exibe erro de validação ao submeter venda sem lookup de código', async () => {
    render(<Movimentacoes />);

    // Submete o form diretamente sem preencher nada — livroIdVenda permanece null
    const formVenda = screen.getByRole('button', { name: /registrar venda/i }).closest('form');
    fireEvent.submit(formVenda);

    await waitFor(() => {
      expect(screen.getByText(/pesquise um item pelo código/i)).toBeInTheDocument();
    });
  });

  it('registra venda com sucesso após lookup', async () => {
    movimentacoesAPI.registrarVenda.mockResolvedValueOnce({ data: {} });
    render(<Movimentacoes />);

    // Segundo campo "Ex: 1001" é o do form de venda
    const [, inputCodigoVenda] = screen.getAllByPlaceholderText('Ex: 1001');
    await userEvent.type(inputCodigoVenda, '1001');
    fireEvent.blur(inputCodigoVenda);

    await waitFor(() => expect(livrosAPI.porCodigo).toHaveBeenCalled());

    const [, inputValorVenda] = screen.getAllByPlaceholderText('0,00');
    await userEvent.type(inputValorVenda, '39,90');
    const [, inputQtdVenda] = screen.getAllByRole('spinbutton');
    await userEvent.type(inputQtdVenda, '5');

    await userEvent.click(screen.getByRole('button', { name: /registrar venda/i }));

    await waitFor(() => {
      expect(screen.getByText('Venda registrada com sucesso!')).toBeInTheDocument();
    });
  });
});
