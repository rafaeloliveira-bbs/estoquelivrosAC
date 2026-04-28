import { useState, useEffect, useCallback, useRef } from 'react';
import { livrosAPI, categoriasAPI, movimentacoesAPI } from '../api/endpoints';
import './Livros.css';

const FORM_VAZIO = {
  codigo_item: '', titulo: '', fornecedor: '', editora: '', classificacao: '',
  tipo_material: '', grade: '', isbn: '', descontinuado: false,
  filial_id: '', preco_custo: '', estoque_minimo: '', categoria_id: '',
};

export default function Livros() {
  const [livros, setLivros] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [livroAtual, setLivroAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [estoques, setEstoques] = useState({});
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const fileInputRef = useRef(null);

  const carregarLivros = useCallback(async () => {
    setLoading(true);
    try {
      const res = busca.trim()
        ? await livrosAPI.buscar(busca.trim())
        : await livrosAPI.listar();
      setLivros(res.data);
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
      codigo_item: livro.codigo_item || '',
      titulo: livro.titulo || '',
      fornecedor: livro.fornecedor || '',
      editora: livro.editora || '',
      classificacao: livro.classificacao || '',
      tipo_material: livro.tipo_material || '',
      grade: livro.grade || '',
      isbn: livro.isbn || '',
      descontinuado: livro.descontinuado || false,
      filial_id: livro.filial_id || '',
      preco_custo: livro.preco_custo || '',
      estoque_minimo: livro.estoque_minimo || '',
      categoria_id: livro.categoria_id || '',
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
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setErro('');
    const payload = {
      codigo_item: form.codigo_item || null,
      titulo: form.titulo,
      fornecedor: form.fornecedor || null,
      editora: form.editora || null,
      classificacao: form.classificacao || null,
      tipo_material: form.tipo_material || null,
      grade: form.grade || null,
      isbn: form.isbn || null,
      descontinuado: form.descontinuado,
      filial_id: parseInt(form.filial_id),
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : 0,
      estoque_minimo: form.estoque_minimo ? parseInt(form.estoque_minimo) : 0,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
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

  const handleBaixarModelo = async () => {
    try {
      const res = await livrosAPI.baixarTemplateCSV();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_importacao.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Erro ao baixar modelo');
    }
  };

  const handleImportarCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setResultadoImport(null);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await livrosAPI.importarCSV(formData);
      setResultadoImport(res.data);
      carregarLivros();
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setImportando(false);
      e.target.value = '';
    }
  };

  return (
    <div className="livros-page">
      <div className="page-header">
        <h1>Livros</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleBaixarModelo}>Baixar Modelo CSV</button>
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
          >
            {importando ? 'Importando...' : 'Importar CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportarCSV}
          />
          <button className="btn-primary" onClick={abrirCriar}>+ Novo Livro</button>
        </div>
      </div>

      {sucesso && <div className="alert-success">{sucesso}</div>}
      {erro && !modal && <div className="alert-error">{erro}</div>}

      {resultadoImport && (
        <div className={`import-result ${resultadoImport.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
          <strong>Importação concluída:</strong> {resultadoImport.criados} criado(s),{' '}
          {resultadoImport.atualizados} atualizado(s).
          {resultadoImport.erros?.length > 0 && (
            <ul>
              {resultadoImport.erros.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button className="btn-close-result" onClick={() => setResultadoImport(null)}>✕</button>
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por título, código, fornecedor, editora ou ISBN..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && <button className="btn-clear" onClick={() => setBusca('')}>✕</button>}
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Fornecedor</th>
                <th>Editora</th>
                <th>Tipo</th>
                <th>Grade</th>
                <th>ISBN 13</th>
                <th>Estoque</th>
                <th>Descontinuado</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {livros.length === 0 ? (
                <tr><td colSpan="11" className="empty">Nenhum livro encontrado</td></tr>
              ) : (
                livros.map((l) => (
                  <tr key={l.id}>
                    <td>{l.codigo_item || '-'}</td>
                    <td>{l.titulo}</td>
                    <td>{l.fornecedor || '-'}</td>
                    <td>{l.editora || '-'}</td>
                    <td>{l.tipo_material || '-'}</td>
                    <td>{l.grade || '-'}</td>
                    <td>{l.isbn || '-'}</td>
                    <td>{estoques[l.id] ?? '...'}</td>
                    <td>
                      <span className={`badge ${l.descontinuado ? 'badge-gray' : 'badge-green'}`}>
                        {l.descontinuado ? 'Sim' : 'Não'}
                      </span>
                    </td>
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
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'criar' ? 'Novo Livro' : 'Editar Livro'}</h2>
              <button className="btn-close" onClick={fecharModal}>✕</button>
            </div>

            {erro && <div className="alert-error">{erro}</div>}

            <form onSubmit={handleSalvar} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Código do Item</label>
                  <input name="codigo_item" value={form.codigo_item} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Título (Descrição) *</label>
                  <input name="titulo" value={form.titulo} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fornecedor</label>
                  <input name="fornecedor" value={form.fornecedor} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Editora</label>
                  <input name="editora" value={form.editora} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Classificação</label>
                  <input name="classificacao" value={form.classificacao} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Tipo do Material</label>
                  <input name="tipo_material" value={form.tipo_material} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Grade</label>
                  <input name="grade" value={form.grade} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>ISBN 13 (opcional)</label>
                  <input name="isbn" value={form.isbn} onChange={handleChange} />
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
              <div className="form-row">
                <div className="form-group">
                  <label>Preço de Custo</label>
                  <input name="preco_custo" type="number" step="0.01" min="0" value={form.preco_custo} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Estoque Mínimo</label>
                  <input name="estoque_minimo" type="number" min="0" value={form.estoque_minimo} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group form-group--inline">
                <input
                  id="descontinuado"
                  name="descontinuado"
                  type="checkbox"
                  checked={form.descontinuado}
                  onChange={handleChange}
                />
                <label htmlFor="descontinuado">Descontinuado?</label>
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
