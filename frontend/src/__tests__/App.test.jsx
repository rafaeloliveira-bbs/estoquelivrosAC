import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

vi.mock('../pages/Login', () => ({ default: () => <div>Página de Login</div> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <div>Página do Dashboard</div> }));
vi.mock('../pages/Movimentacoes', () => ({ default: () => <div>Página de Movimentações</div> }));

// Substitui BrowserRouter por MemoryRouter para controlar a rota inicial nos testes
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BrowserRouter: ({ children }) => <actual.MemoryRouter>{children}</actual.MemoryRouter>,
  };
});

describe('App — roteamento', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redireciona para /login quando não há token (rota protegida)', () => {
    render(<App />);
    expect(screen.getByText('Página de Login')).toBeInTheDocument();
  });

  it('exibe Dashboard na rota / quando autenticado', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'a@a.com', role: 'gestor', filial_id: 1, filial_ids: [1] }));
    render(<App />);
    expect(screen.getByText('Página do Dashboard')).toBeInTheDocument();
  });
});
