import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/endpoints';
import useAuthStore from '../store/authStore';
import logo from '../logodef.jpeg';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(email, senha);
      const { access_token, refresh_token } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refreshToken', refresh_token);

      setUser({ email }, access_token);
      navigate('/');
    } catch (err) {
      setError('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo-wrap">
          <img src={logo} alt="Logo Estoque Livros AC" className="login-logo" />
        </div>
        <h1>Bright</h1>
        <p className="login-subtitle">Estoque de Livros</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}
