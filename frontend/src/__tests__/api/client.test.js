import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '../../api/client';

const mock = new MockAdapter(apiClient);

describe('apiClient — interceptors', () => {
  beforeEach(() => {
    mock.reset();
    localStorage.clear();
    vi.stubGlobal('location', { href: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injeta header Authorization quando token está presente no localStorage', async () => {
    localStorage.setItem('token', 'meu-token');

    let headersCapturados;
    mock.onGet('/teste').reply((config) => {
      headersCapturados = config.headers;
      return [200, {}];
    });

    await apiClient.get('/teste');
    expect(headersCapturados.Authorization).toBe('Bearer meu-token');
  });

  it('não injeta Authorization quando não há token no localStorage', async () => {
    let headersCapturados;
    mock.onGet('/teste').reply((config) => {
      headersCapturados = config.headers;
      return [200, {}];
    });

    await apiClient.get('/teste');
    expect(headersCapturados.Authorization).toBeUndefined();
  });

  it('remove token e redireciona para /login em resposta 401', async () => {
    localStorage.setItem('token', 'meu-token');
    mock.onGet('/protegido').reply(401);

    await apiClient.get('/protegido').catch(() => {});

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
