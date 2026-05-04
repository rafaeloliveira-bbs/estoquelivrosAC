import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { livrosAPI, categoriasAPI, filiaisAPI } from '../api/endpoints';
import { getUserRole, getTokenPayload } from '../utils/auth';
import { parseMoeda, formatMoedaBR } from '../utils/moeda';
import './Livros.css';

const FORM_VAZIO = {
  codigo_item: '', titulo: '', fornecedor: '', editora: '', classificacao: '',
  tipo_material: '', grade: '', isbn: '', descontinuado: false,
  filial_id: '', preco_custo: '', estoque_minimo: '', categoria_id: '',
};

export default function Livros() {
  const queryClient = useQueryClient();
  const isAdmin = getUserRole() === 'admin';
  const filialIds = getTokenPayload()?.filial_ids ?? [];
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filialFiltro, setFilialFiltro] = useState(null);
  const [sortColuna, setSortColuna] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [modal, setModal] = useState(null);
  const [livroAtual, setLivroAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [importando, setImportando] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [csvMenuAberto, setCsvMenuAberto] = useState(false);
  const csvMenuRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!csvMenuAberto) return;
    const fechar = (e) => {
      if (csvMenuRef.current && !csvMenuRef.current.contains(e.target)) {
        setCsvMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [csvMenuAberto]);

  useEffect(() => {
    if (!importando) return;
    setImportProgress(10);
    const interval = setInterval(() => {
      setImportProgress((p) => (p >= 85 ? p : p + (85 - p) * 0.12));
    }, 250);
    return () => clearInterval(interval);
  }, [importando]);

  const { data: livros = [], isLoading: loading } = useQuery({
    queryKey: ['livros', buscaDebounced, filialFiltro],
    queryFn: () =>
      livrosAPI.listarComEstoque(buscaDebounced.trim() || null, filialFiltro).then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => categoriasAPI.listar().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: filiais = [] } = useQuery({
    queryKey: ['filiais'],
    queryFn: () =>
      filiaisAPI.listar().then((r) => r.data.filter((f) => filialIds.includes(f.id))),
    staleTime: 10 * 60_000,
    enabled: filialIds.length > 1,
  });

  const invalidarLivros = () =>
    queryClient.invalidateQueries({ queryKey: ['livros'] });

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
      preco_custo: livro.preco_custo ? formatMoedaBR(livro.preco_custo) : '',
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
      preco_custo: parseMoeda(form.preco_custo),
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
      invalidarLivros();
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
      invalidarLivros();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao desativar livro');
    }
  };

  const handleLimparTodos = async () => {
    if (!confirm('Atenção: isso removerá TODOS os livros da filial permanentemente. Continuar?')) return;
    if (!confirm('Tem certeza absoluta? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await livrosAPI.limparTodos();
      setSucesso(`${res.data.removidos} livro(s) removido(s).`);
      invalidarLivros();
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao limpar livros');
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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErro('');
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await livrosAPI.previewCSV(formData);
      setPreview(res.data);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao analisar arquivo');
      e.target.value = '';
    }
  };

  const handleConfirmarImportacao = async () => {
    if (!selectedFile) return;
    setImportando(true);
    setImportProgress(0);
    setResultadoImport(null);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await livrosAPI.importarCSV(formData);
      setResultadoImport(res.data);
      setPreview(null);
      setSelectedFile(null);
      invalidarLivros();
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setImportando(false);
      setImportProgress(100);
      setTimeout(() => setImportProgress(0), 700);
    }
  };

  const handleOrdenar = (coluna) => {
    if (sortColuna === coluna) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColuna(coluna);
      setSortDir('asc');
    }
  };

  const livrosOrdenados = sortColuna
    ? [...livros].sort((a, b) => {
        const va = a[sortColuna] ?? '';
        const vb = b[sortColuna] ?? '';
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : livros;

  const SortIcon = ({ coluna }) => {
    if (sortColuna !== coluna) return <span className="sort-icon sort-icon--idle">⇅</span>;
    return <span className="sort-icon sort-icon--active">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleCancelarPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    fileInputRef.current.value = '';
  };


  return (
    <div className="livros-page">
      <div className="page-header">
        <h1>Livros</h1>
        <div className="header-actions">
          {isAdmin && <button className="btn-danger" onClick={handleLimparTodos}>Limpar todos</button>}
          {isAdmin && (
            <div className="csv-dropdown" ref={csvMenuRef}>
              <button
                className="btn-secondary"
                onClick={() => setCsvMenuAberto((v) => !v)}
                disabled={importando}
              >
                {importando ? 'Importando...' : 'CSV ▾'}
              </button>
              {csvMenuAberto && (
                <div className="csv-menu">
                  <button onClick={() => { handleBaixarModelo(); setCsvMenuAberto(false); }}>
                    Baixar Modelo
                  </button>
                  <button onClick={() => { fileInputRef.current?.click(); setCsvMenuAberto(false); }}>
                    Importar
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          )}
          <button className="btn-primary" onClick={abrirCriar}>+ Novo Livro</button>
        </div>
      </div>

      {sucesso && <div className="alert-success">{sucesso}</div>}
      {erro && !modal && <div className="alert-error">{erro}</div>}

      {importProgress > 0 && (
        <div className="import-progress-wrap">
          <div className="import-progress-label">
            {importando ? `Importando... ${Math.round(importProgress)}%` : 'Concluído!'}
          </div>
          <div className="import-progress-track">
            <div
              className="import-progress-bar"
              style={{ width: `${Math.min(importProgress, 100)}%`, transition: importando ? 'width 0.25s ease' : 'width 0.4s ease' }}
            />
          </div>
        </div>
      )}

      {resultadoImport && (
        <div className={`import-result ${resultadoImport.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
          <strong>Importação concluída:</strong> {resultadoImport.criados} criado(s),{' '}
          {resultadoImport.atualizados} atualizado(s)
          {resultadoImport.estoque_importado > 0 && `, ${resultadoImport.estoque_importado} estoque(s) registrado(s)`}.
          {resultadoImport.erros?.length > 0 && (
            <ul>
              {resultadoImport.erros.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button className="btn-close-result" onClick={() => setResultadoImport(null)}>✕</button>
        </div>
      )}

      {preview && (
        <div className="preview-section">
          <h2>Pré-visualização da Importação</h2>

          {preview.warnings.length > 0 && (
            <div className="warnings">
              <h3>⚠️ Avisos:</h3>
              <ul>
                {preview.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mapping-info">
            <h3>Mapeamento de Colunas:</h3>
            <div className="mapping-grid">
              {Object.entries(preview.column_mapping).map(([field, colName]) => (
                <div key={field} className={`mapping-item ${colName ? 'mapped' : 'unmapped'}`}>
                  <strong>{field}:</strong> {colName || 'Não encontrado'}
                </div>
              ))}
            </div>
          </div>

          <div className="preview-table">
            <h3>Primeiras {preview.mapped_preview.length} linhas (dados processados):</h3>
            <table>
              <thead>
                <tr>
                  {Object.keys(preview.mapped_preview[0] || {}).map(field => (
                    <th key={field}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.mapped_preview.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((value, cellIdx) => (
                      <td key={cellIdx} className={typeof value === 'string' && value.startsWith('Erro:') ? 'error-cell' : ''}>
                        {value === null || value === undefined ? '-' : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="preview-actions">
            <button
              className="btn-primary"
              onClick={handleConfirmarImportacao}
              disabled={importando}
            >
              {importando ? 'Importando...' : 'Confirmar Importação'}
            </button>
            <button className="btn-secondary" onClick={handleCancelarPreview}>
              Cancelar
            </button>
          </div>
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

      {filiais.length > 1 && (
        <div className="filial-filter">
          <span className="filial-filter-label">Filial:</span>
          <div className="filial-flags">
            <button
              className={`filial-flag ${filialFiltro === null ? 'filial-flag--active' : ''}`}
              onClick={() => setFilialFiltro(null)}
            >
              Todas
            </button>
            {filiais.map((f) => (
              <button
                key={f.id}
                className={`filial-flag ${filialFiltro === f.id ? 'filial-flag--active' : ''}`}
                onClick={() => setFilialFiltro(f.id)}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  ['codigo_item', 'Item'],
                  ['titulo', 'Títulos'],
                  ['fornecedor', 'Fornecedor'],
                  ['editora', 'Editora'],
                  ['classificacao', 'Classificação'],
                  ['tipo_material', 'Tipo do material'],
                  ['grade', 'Grade'],
                  ['isbn', 'ISBN 13'],
                  ['descontinuado', 'Descontinuado?'],
                  ['estoque_total', 'Estoque'],
                  ['status', 'Status'],
                ].map(([col, label]) => (
                  <th key={col} className="th-sortable" onClick={() => handleOrdenar(col)}>
                    {label} <SortIcon coluna={col} />
                  </th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {livrosOrdenados.length === 0 ? (
                <tr><td colSpan="12" className="empty">Nenhum livro encontrado</td></tr>
              ) : (
                livrosOrdenados.map((l) => (
                  <tr key={l.id}>
                    <td>{l.codigo_item || '-'}</td>
                    <td>{l.titulo}</td>
                    <td>{l.fornecedor || '-'}</td>
                    <td>{l.editora || '-'}</td>
                    <td>{l.classificacao || '-'}</td>
                    <td>{l.tipo_material || '-'}</td>
                    <td>{l.grade || '-'}</td>
                    <td>{l.isbn || '-'}</td>
                    <td>
                      <span className={`badge ${l.descontinuado ? 'badge-gray' : 'badge-green'}`}>
                        {l.descontinuado ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>{l.estoque_total}</td>
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
                  <input name="preco_custo" type="text" inputMode="decimal" placeholder="R$ 0,00" value={form.preco_custo} onChange={handleChange} />
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
