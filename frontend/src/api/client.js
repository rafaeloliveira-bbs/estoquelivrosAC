import axios from 'axios';

// Em dev, usa proxy Vite (/api → localhost:8000) para que cookies httpOnly funcionem
// sem HTTPS. Em produção, VITE_API_URL aponta para o backend real.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // envia cookies httpOnly automaticamente
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle 401 — limpa dados do usuário e redireciona para login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
