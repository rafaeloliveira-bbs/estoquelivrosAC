import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { filiaisAPI } from '../api/endpoints';
import { getUserRole } from '../utils/auth';
import './Filiais.css';

const FORM_VAZIO = { nome: '', cnpj: '', endereco: '' };

export default function Filiais() {
  const queryClient = useQueryClient();
  const isAdmin = getUserRole() === 'admin';

  const [modal, setModal] = useState(null); // 'criar' | 'editar'
  const [filialAtual, setFilialAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const { data: filiais = [], isLoading, isError } = useQuery({
    queryKey: ['filiais'],
    queryFn: () => filiaisAPI.listar().then((r) => r.data),
    staleTime: 30_000,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['filiais'] });

  const abrirCriar = () => {
    setForm(FORM_VAZIO);
    setErro('');
    setModal('criar');
  };

  const abrirEditar = (f) => {
    setFilialAtual(f);
    setForm({ nome: f.nome, cnpj: f.cnpj, endereco: f.endereco || '' });
    setErro('');
    setModal('editar');
  };

  const fecharModal = () => {
    setModal(null);
    setFilialAtual(null);
    setForm(FORM_VAZIO);
    setErro('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (modal === 'criar') {
        await filiaisAPI.criar({ nome: form.nome, cnpj: form.cnpj, endereco: form.endereco || undefined });
        setSucesso('Filial cadastrada com sucesso!');
      } else {
        await filiaisAPI.atualizar(filialAtual.id, { nome: form.nome, endereco: form.endereco || undefined });
        setSucesso('Filial atualizada com sucesso!');
      }
      invalidar();
      fecharModal();
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao salvar filial');
    }
  };

  if (isLoading) return <div className="loading">Carregando...</div>;
  if (isError) return <div className="error">Erro ao carregar filiais</div>;

  return (
    <div className="filiais-page">
      <div className="filiais-header">
        <h1>Filiais</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={abrirCriar}>
            + Nova Filial
          </button>
        )}
      </div>

      {sucesso && <div className="alert-success">{sucesso}</div>}

      <div className="table-wrapper">
      <table className="filiais-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>CNPJ</th>
            <th>Endereço</th>
            <th>Cadastro</th>
            {isAdmin && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {filiais.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: '#999' }}>
                Nenhuma filial cadastrada
              </td>
            </tr>
          ) : (
            filiais.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td><strong>{f.nome}</strong></td>
                <td>{f.cnpj}</td>
                <td>{f.endereco || '—'}</td>
                <td>{new Date(f.criado_em).toLocaleDateString('pt-BR')}</td>
                {isAdmin && (
                  <td>
                    <button className="btn-edit" onClick={() => abrirEditar(f)}>
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'criar' ? 'Nova Filial' : 'Editar Filial'}</h2>
              <button className="btn-close" onClick={fecharModal}>✕</button>
            </div>

            <form onSubmit={handleSalvar} className="filiais-form">
              {erro && <div className="alert-error">{erro}</div>}
              <div className="form-group">
                <label>Nome *</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  required
                  placeholder="Nome da filial"
                />
              </div>

              <div className="form-group">
                <label>CNPJ *</label>
                <input
                  name="cnpj"
                  value={form.cnpj}
                  onChange={handleChange}
                  required={modal === 'criar'}
                  disabled={modal === 'editar'}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="form-group">
                <label>Endereço</label>
                <input
                  name="endereco"
                  value={form.endereco}
                  onChange={handleChange}
                  placeholder="Endereço completo"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn-primary">
                  {modal === 'criar' ? 'Cadastrar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
