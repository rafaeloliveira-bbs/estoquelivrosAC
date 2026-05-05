import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import { authAPI } from '../../api/endpoints';
import useAuthStore from '../../store/authStore';

vi.mock('../../api/endpoints', () => ({
  authAPI: { login: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const USER_MOCK = { id: 1, email: 'admin@estoque.com', role: 'admin', filial_id: 1, filial_ids: [1] };

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: null });
  });

  it('renderiza campos de email e senha', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('exibe campos vazios por padrão', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByLabelText(/senha/i)).toHaveValue('');
  });

  it('armazena dados do usuário no localStorage e redireciona para / após login bem-sucedido', async () => {
    authAPI.login.mockResolvedValueOnce({
      data: { user: USER_MOCK, access_token: 'token-123', expires_in: 3600 },
    });

    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@estoque.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user'));
      expect(stored.email).toBe('admin@estoque.com');
      expect(stored.role).toBe('admin');
      // JWT não deve estar no localStorage
      expect(localStorage.getItem('token')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('exibe mensagem de erro em credenciais inválidas', async () => {
    authAPI.login.mockRejectedValueOnce(new Error('Unauthorized'));

    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/email/i), 'wrong@email.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Email ou senha incorretos')).toBeInTheDocument();
    });
  });

  it('desabilita botão e exibe "Autenticando..." durante a requisição', async () => {
    authAPI.login.mockImplementationOnce(() => new Promise(() => {}));

    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@estoque.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(screen.getByRole('button', { name: /autenticando/i })).toBeDisabled();
  });
});
