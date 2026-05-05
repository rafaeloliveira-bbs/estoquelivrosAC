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

  it('envia requisições com withCredentials true (cookies automáticos)', async () => {
    let configCapturada;
    mock.onGet('/teste').reply((config) => {
      configCapturada = config;
      return [200, {}];
    });

    await apiClient.get('/teste');
    expect(configCapturada.withCredentials).toBe(true);
  });

  it('não injeta header Authorization (auth via cookie)', async () => {
    let headersCapturados;
    mock.onGet('/teste').reply((config) => {
      headersCapturados = config.headers;
      return [200, {}];
    });

    await apiClient.get('/teste');
    expect(headersCapturados.Authorization).toBeUndefined();
  });

  it('remove dados do usuário e redireciona para /login em resposta 401', async () => {
    localStorage.setItem('user', JSON.stringify({ email: 'a@a.com', role: 'gestor' }));
    mock.onGet('/protegido').reply(401);

    await apiClient.get('/protegido').catch(() => {});

    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
