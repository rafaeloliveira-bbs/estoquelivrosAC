import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usuariosAPI } from '../api/endpoints';
import './Usuarios.css';

const ROLES = ['admin', 'gestor'];

const FORM_VAZIO = {
  nome: '', email: '', senha: '', role: 'gestor', filial_id: '', ativo: true,
};

export default function Usuarios() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosAPI.listar().then((r) => r.data),
    staleTime: 30_000,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] });

  const abrirCriar = () => {
    setForm(FORM_VAZIO);
    setErro('');
    setModal('criar');
  };

  const abrirEditar = (u) => {
    setUsuarioAtual(u);
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      role: u.role,
      filial_id: u.filial_id,
      ativo: u.ativo,
    });
    setErro('');
    setModal('editar');
  };

  const fecharModal = () => {
    setModal(null);
    setUsuarioAtual(null);
    setForm(FORM_VAZIO);
    setErro('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (modal === 'criar') {
        const payload = {
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          role: form.role,
        };
        await usuariosAPI.criar(payload);
        setSucesso('Usuário criado com sucesso!');
      } else {
        const payload = {
          nome: form.nome,
          email: form.email,
          role: form.role,
          ativo: form.ativo,
        };
        if (form.senha) payload.senha = form.senha;
        await usuariosAPI.atualizar(usuarioAtual.id, payload);
        setSucesso('Usuário atualizado com sucesso!');
      }
      fecharModal();
      invalidar();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao salvar usuário');
    }
  };

  const handleDesativar = async (u) => {
    if (!confirm(`Desativar o usuário "${u.nome}"?`)) return;
    try {
      await usuariosAPI.deletar(u.id);
      setSucesso('Usuário desativado.');
      invalidar();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao desativar usuário');
    }
  };

  const roleBadgeClass = (role) => {
    if (role === 'admin') return 'badge badge-admin';
    return 'badge badge-blue';
  };

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <h1>Usuários</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={abrirCriar}>+ Novo Usuário</button>
        </div>
      </div>

      {sucesso && <div className="alert-success">{sucesso}</div>}
      {erro && !modal && <div className="alert-error">{erro}</div>}

      {isLoading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Filial</th>
                <th>Status</th>
                <th>Último Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr><td colSpan="8" className="empty">Nenhum usuário encontrado</td></tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td><span className={roleBadgeClass(u.role)}>{u.role}</span></td>
                    <td>{u.filial_id}</td>
                    <td>
                      <span className={`badge ${u.ativo ? 'badge-green' : 'badge-gray'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      {u.ultimo_acesso
                        ? new Date(u.ultimo_acesso).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td className="actions">
                      <button className="btn-edit" onClick={() => abrirEditar(u)}>Editar</button>
                      <button className="btn-delete" onClick={() => handleDesativar(u)}>Desativar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'criar' ? 'Novo Usuário' : 'Editar Usuário'}</h2>
              <button className="btn-close" onClick={fecharModal}>✕</button>
            </div>

            {erro && <div className="alert-error">{erro}</div>}

            <form onSubmit={handleSalvar} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nome *</label>
                  <input name="nome" value={form.nome} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{modal === 'criar' ? 'Senha *' : 'Nova senha (deixe em branco para manter)'}</label>
                  <input
                    name="senha"
                    type="password"
                    value={form.senha}
                    onChange={handleChange}
                    required={modal === 'criar'}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label>Perfil *</label>
                  <select name="role" value={form.role} onChange={handleChange} required>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>


              {modal === 'editar' && (
                <div className="form-group form-group--inline">
                  <input
                    id="ativo"
                    name="ativo"
                    type="checkbox"
                    checked={form.ativo}
                    onChange={handleChange}
                  />
                  <label htmlFor="ativo">Usuário ativo</label>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
