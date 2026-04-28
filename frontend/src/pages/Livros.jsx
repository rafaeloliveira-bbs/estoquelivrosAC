import { useState, useEffect, useCallback } from 'react';
import { livrosAPI, categoriasAPI, movimentacoesAPI } from '../api/endpoints';
import './Livros.css';

const FORM_VAZIO = {
  titulo: '', autor: '', isbn: '', preco_custo: '', categoria_id: '', filial_id: '', estoque_minimo: ''
};

export default function Livros() {
  const [livros, setLivros] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'criar' | 'editar'
  const [livroAtual, setLivroAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [estoques, setEstoques] = useState({});
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregarLivros = useCallback(async () => {
    setLoading(true);
    try {
      const res = busca.trim()
        ? await livrosAPI.buscar(busca.trim())
        : await livrosAPI.listar();
      setLivros(res.data);
      // carrega estoque de cada livro
      const estoqueMap = {};
      await Promise.all(
        res.data.map(async (l) => {
          try {
            const e = await movimentacoesAPI.obterEstoque(l.id);
            estoqueMap[l.id] = e.data.estoque_total;
          } catch {
            estoqueMap[l.id] = '-';
          }
        })
      );
      setEstoques(estoqueMap);
    } catch {
      setErro('Erro ao carregar livros');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    carregarLivros();
    categoriasAPI.listar().then((r) => setCategorias(r.data)).catch(() => {});
  }, [carregarLivros]);

  const abrirCriar = () => {
    setForm(FORM_VAZIO);
    setErro('');
    setModal('criar');
  };

  const abrirEditar = (livro) => {
    setLivroAtual(livro);
    setForm({
      titulo: livro.titulo || '',
      autor: livro.autor || '',
      isbn: livro.isbn || '',
      preco_custo: livro.preco_custo || '',
      categoria_id: livro.categoria_id || '',
      filial_id: livro.filial_id || '',
      estoque_minimo: livro.estoque_minimo || '',
    });
    setErro('');
    setModal('editar');
  };

  const fecharModal = () => {
    setModal(null);
    setLivroAtual(null);
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
    const payload = {
      titulo: form.titulo,
      autor: form.autor,
      isbn: form.isbn || null,
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      filial_id: parseInt(form.filial_id),
      estoque_minimo: form.estoque_minimo ? parseInt(form.estoque_minimo) : null,
    };
    try {
      if (modal === 'criar') {
        await livrosAPI.criar(payload);
        setSucesso('Livro criado com sucesso!');
      } else {
        await livrosAPI.atualizar(livroAtual.id, payload);
        setSucesso('Livro atualizado com sucesso!');
      }
      fecharModal();
      carregarLivros();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao salvar livro');
    }
  };

  const handleDeletar = async (livro) => {
    if (!confirm(`Desativar "${livro.titulo}"?`)) return;
    try {
      await livrosAPI.deletar(livro.id);
      setSucesso('Livro desativado.');
      carregarLivros();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao desativar livro');
    }
  };

  return (
    <div className="livros-page">
      <div className="page-header">
        <h1>Livros</h1>
        <button className="btn-primary" onClick={abrirCriar}>+ Novo Livro</button>
      </div>

      {sucesso && <div className="alert-success">{sucesso}</div>}
      {erro && !modal && <div className="alert-error">{erro}</div>}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por título, autor ou ISBN..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button className="btn-clear" onClick={() => setBusca('')}>✕</button>
        )}
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Autor</th>
                <th>ISBN</th>
                <th>Preço Custo</th>
                <th>Estoque</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {livros.length === 0 ? (
                <tr><td colSpan="8" className="empty">Nenhum livro encontrado</td></tr>
              ) : (
                livros.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>{l.titulo}</td>
                    <td>{l.autor}</td>
                    <td>{l.isbn || '-'}</td>
                    <td>{l.preco_custo != null ? `R$ ${parseFloat(l.preco_custo).toFixed(2)}` : '-'}</td>
                    <td>{estoques[l.id] ?? '...'}</td>
                    <td>
                      <span className={`badge ${l.status === 'ativo' ? 'badge-green' : 'badge-gray'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn-edit" onClick={() => abrirEditar(l)}>Editar</button>
                      <button className="btn-delete" onClick={() => handleDeletar(l)}>Desativar</button>
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
              <h2>{modal === 'criar' ? 'Novo Livro' : 'Editar Livro'}</h2>
              <button className="btn-close" onClick={fecharModal}>✕</button>
            </div>

            {erro && <div className="alert-error">{erro}</div>}

            <form onSubmit={handleSalvar} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Título *</label>
                  <input name="titulo" value={form.titulo} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Autor *</label>
                  <input name="autor" value={form.autor} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ISBN</label>
                  <input name="isbn" value={form.isbn} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Preço de Custo</label>
                  <input name="preco_custo" type="number" step="0.01" min="0" value={form.preco_custo} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ID da Filial *</label>
                  <input name="filial_id" type="number" min="1" value={form.filial_id} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select name="categoria_id" value={form.categoria_id} onChange={handleChange}>
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
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
