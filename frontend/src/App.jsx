import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Movimentacoes from './pages/Movimentacoes';
import Livros from './pages/Livros';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Filiais from './pages/Filiais';
import { getUserRole } from './utils/auth';
import logo from './logodef.jpeg';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  if (getUserRole() !== 'admin') return <Navigate to="/" />;
  return children;
}

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) return null;

  const role = getUserRole();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const navLink = (path, label) => (
    <li>
      <a
        href={path}
        className={location.pathname === path ? 'nav-active' : ''}
        onClick={(e) => { e.preventDefault(); navigate(path); }}
      >
        {label}
      </a>
    </li>
  );

  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img src={logo} alt="Logo" className="nav-logo" />
        <span className="nav-brand-name">
          <span className="brand-bright">Bright</span>
          <span className="brand-sub">Estoque de Livros</span>
        </span>
      </div>
      <ul className="nav-menu">
        {navLink('/', 'Dashboard')}
        {navLink('/livros', 'Livros')}
        {navLink('/movimentacoes', 'Movimentações')}
        {navLink('/relatorios', 'Relatórios')}
        {navLink('/filiais', 'Filiais')}
        {role === 'admin' && navLink('/usuarios', 'Usuários')}
        <li>
          <button onClick={handleLogout} className="logout-btn">Sair</button>
        </li>
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/livros" element={<PrivateRoute><Livros /></PrivateRoute>} />
        <Route path="/movimentacoes" element={<PrivateRoute><Movimentacoes /></PrivateRoute>} />
        <Route path="/relatorios" element={<PrivateRoute><Relatorios /></PrivateRoute>} />
        <Route path="/filiais" element={<PrivateRoute><Filiais /></PrivateRoute>} />
        <Route path="/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
      </Routes>
    </Router>
  );
}
