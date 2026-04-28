import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '../../store/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isLoading: false, error: null });
  });

  it('define usuário e token via setUser', () => {
    useAuthStore.getState().setUser({ email: 'admin@estoque.com' }, 'token-abc');
    const { user, token } = useAuthStore.getState();
    expect(user).toEqual({ email: 'admin@estoque.com' });
    expect(token).toBe('token-abc');
  });

  it('limpa usuário e token no logout', () => {
    useAuthStore.setState({ user: { email: 'admin@estoque.com' }, token: 'token-abc' });
    useAuthStore.getState().logout();
    const { user, token } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it('altera isLoading via setLoading', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('armazena mensagem de erro via setError', () => {
    useAuthStore.getState().setError('Credenciais inválidas');
    expect(useAuthStore.getState().error).toBe('Credenciais inválidas');
  });
});
