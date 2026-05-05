import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '../../store/authStore';

const USER_MOCK = { id: 1, email: 'admin@estoque.com', role: 'admin', filial_id: 1, filial_ids: [1] };

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false, error: null });
  });

  it('define usuário via setUser', () => {
    useAuthStore.getState().setUser(USER_MOCK);
    const { user } = useAuthStore.getState();
    expect(user).toEqual(USER_MOCK);
  });

  it('limpa usuário no logout', () => {
    useAuthStore.setState({ user: USER_MOCK });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
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
