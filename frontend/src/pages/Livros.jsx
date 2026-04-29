import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { livrosAPI, categoriasAPI, movimentacoesAPI } from '../api/endpoints';
import { getUserRole } from '../utils/auth';
import './Livros.css';

const FORM_VAZIO = {
  codigo_item: '', titulo: '', fornecedor: '', editora: '', classificacao: '',
  tipo_material: '', grade: '', isbn: '', descontinuado: false,
  filial_id: '', preco_custo: '', estoque_minimo: '', categoria_id: '',
};

export default function Livros() {
  const queryClient = useQueryClient();
  const isAdmin = getUserRole() === 'admin';
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [modal, setModal] = useState(null);
  const [livroAtual, setLivroAtual] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // estoque CSV
  const [importandoEstoque, setImportandoEstoque] = useState(false);
  const [resultadoEstoqueImport, setResultadoEstoqueImport] = useState(null);
  const [previewEstoque, setPreviewEstoque] = useState(null);
  const [selectedEstoqueFile, setSelectedEstoqueFile] = useState(null);
  const estoqueFileInputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: livros = [], isLoading: loading } = useQuery({
    queryKey: ['livros', buscaDebounced],
    queryFn: () =>
      livrosAPI.listarComEstoque(buscaDebounced.trim() || null).then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => categoriasAPI.listar().then((r) => r.data),
    staleTime: 5 * 60_000,
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
    }
  };

  const handleCancelarPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    fileInputRef.current.value = '';
  };

  const handleBaixarModeloEstoque = async () => {
    try {
      const res = await movimentacoesAPI.templateEstoqueCSV();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_estoque.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Erro ao baixar modelo de estoque');
    }
  };

  const handleEstoqueFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedEstoqueFile(file);
    setErro('');
    setPreviewEstoque(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await movimentacoesAPI.previewEstoqueCSV(formData);
      setPreviewEstoque(res.data);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao analisar arquivo de estoque');
      e.target.value = '';
    }
  };

  const handleConfirmarImportacaoEstoque = async () => {
    if (!selectedEstoqueFile) return;
    setImportandoEstoque(true);
    setResultadoEstoqueImport(null);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('file', selectedEstoqueFile);
      const res = await movimentacoesAPI.importarEstoqueCSV(formData);
      setResultadoEstoqueImport(res.data);
      setPreviewEstoque(null);
      setSelectedEstoqueFile(null);
      invalidarLivros();
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao importar estoque');
    } finally {
      setImportandoEstoque(false);
    }
  };

  const handleCancelarPreviewEstoque = () => {
    setPreviewEstoque(null);
    setSelectedEstoqueFile(null);
    estoqueFileInputRef.current.value = '';
  };

  return (
    <div className="livros-page">
      <div className="page-header">
        <h1>Livros</h1>
        <div className="header-actions">
          {isAdmin && <button className="btn-danger" onClick={handleLimparTodos}>Limpar todos</button>}
          {isAdmin && <button className="btn-secondary" onClick={handleBaixarModelo}>Baixar Modelo Livros</button>}
          {isAdmin && (
            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importando}
            >
              {importando ? 'Importando...' : 'Importar Livros CSV'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          {isAdmin && <button className="btn-secondary" onClick={handleBaixarModeloEstoque}>Baixar Modelo Estoque</button>}
          {isAdmin && (
            <button
              className="btn-secondary"
              onClick={() => estoqueFileInputRef.current?.click()}
              disabled={importandoEstoque}
            >
              {importandoEstoque ? 'Importando...' : 'Importar Estoque CSV'}
            </button>
          )}
          <input
            ref={estoqueFileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleEstoqueFileSelect}
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

      {resultadoEstoqueImport && (
        <div className={`import-result ${resultadoEstoqueImport.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
          <strong>Importação de estoque concluída:</strong> {resultadoEstoqueImport.importados} item(ns) importado(s).
          {resultadoEstoqueImport.erros?.length > 0 && (
            <ul>
              {resultadoEstoqueImport.erros.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button className="btn-close-result" onClick={() => setResultadoEstoqueImport(null)}>✕</button>
        </div>
      )}

      {previewEstoque && (
        <div className="preview-section">
          <h2>Pré-visualização — Importação de Estoque</h2>

          {previewEstoque.erros?.length > 0 && (
            <div className="warnings">
              <h3>Avisos:</h3>
              <ul>
                {previewEstoque.erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Código Item</th>
                  <th>Título</th>
                  <th>Quantidade</th>
                  <th>Preço Unitário</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewEstoque.preview.map((row) => (
                  <tr key={row.linha} className={!row.encontrado ? 'row-error' : ''}>
                    <td>{row.linha}</td>
                    <td>{row.codigo_item}</td>
                    <td>{row.titulo}</td>
                    <td>{row.quantidade}</td>
                    <td>{row.preco_unitario > 0 ? `R$ ${row.preco_unitario.toFixed(2)}` : '—'}</td>
                    <td>
                      <span className={`badge ${row.encontrado ? 'badge-green' : 'badge-gray'}`}>
                        {row.encontrado ? 'OK' : 'Não encontrado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="preview-actions">
            <button
              className="btn-primary"
              onClick={handleConfirmarImportacaoEstoque}
              disabled={importandoEstoque || previewEstoque.preview.every((r) => !r.encontrado)}
            >
              {importandoEstoque ? 'Importando...' : 'Confirmar Importação de Estoque'}
            </button>
            <button className="btn-secondary" onClick={handleCancelarPreviewEstoque}>
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

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Títulos</th>
                <th>Fornecedor</th>
                <th>Editora</th>
                <th>Classificação</th>
                <th>Tipo do material</th>
                <th>Grade</th>
                <th>ISBN 13</th>
                <th>Descontinuado?</th>
                <th>Estoque</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {livros.length === 0 ? (
                <tr><td colSpan="12" className="empty">Nenhum livro encontrado</td></tr>
              ) : (
                livros.map((l) => (
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
