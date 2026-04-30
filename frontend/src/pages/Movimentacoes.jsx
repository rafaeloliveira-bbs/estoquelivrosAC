import { useState, useEffect, useRef } from 'react';
import { livrosAPI, movimentacoesAPI, relatoriosAPI } from '../api/endpoints';
import { getUserRole } from '../utils/auth';
import { parseMoeda } from '../utils/moeda';
import './Movimentacoes.css';

export default function Movimentacoes() {
  const [secao, setSecao] = useState('registrar'); // 'registrar' | 'historico'
  const [tipo, setTipo] = useState('venda');

  // campos do formulário
  const [buscaLivro, setBuscaLivro] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [livroSelecionado, setLivroSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // histórico
  const [historico, setHistorico] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // importação CSV de histórico de entradas
  const isAdmin = getUserRole() === 'admin' || getUserRole() === 'gestor';
  const fileInputRef = useRef(null);
  const csvMenuRef = useRef(null);
  const [csvMenuAberto, setCsvMenuAberto] = useState(false);
  const [previewEntradas, setPreviewEntradas] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [erroImport, setErroImport] = useState('');

  // fecha o menu CSV ao clicar fora
  useEffect(() => {
    const fechar = (e) => {
      if (csvMenuRef.current && !csvMenuRef.current.contains(e.target)) {
        setCsvMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  // busca de livro ao digitar
  useEffect(() => {
    if (!buscaLivro.trim()) { setResultadosBusca([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await livrosAPI.buscar(buscaLivro.trim(), 0, 8);
        setResultadosBusca(res.data);
      } catch { setResultadosBusca([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [buscaLivro]);

  const selecionarLivro = (livro) => {
    setLivroSelecionado(livro);
    setBuscaLivro(livro.titulo);
    setResultadosBusca([]);
  };

  const resetForm = () => {
    setBuscaLivro('');
    setLivroSelecionado(null);
    setResultadosBusca([]);
    setQuantidade('');
    setPrecoUnitario('');
    setNumeroLote('');
    setFornecedor('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const livroId = livroSelecionado?.id || parseInt(buscaLivro) || null;
    if (!livroId) { setError('Selecione um livro'); return; }
    setLoading(true);
    setMessage('');
    setError('');
    try {
      if (tipo === 'venda') {
        await movimentacoesAPI.registrarVenda(livroId, parseInt(quantidade), '', '');
        setMessage('Venda registrada com sucesso!');
      } else {
        await movimentacoesAPI.registrarCompra(
          livroId, parseInt(quantidade),
          parseMoeda(precoUnitario), numeroLote, fornecedor
        );
        setMessage('Compra registrada com sucesso!');
      }
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao registrar movimentação');
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const res = await relatoriosAPI.movimentacoes(dataInicio || undefined, dataFim || undefined);
      setHistorico(res.data.movimentacoes || []);
    } catch {
      setHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    if (secao === 'historico') carregarHistorico();
  }, [secao]);

  // ── CSV histórico de entradas ────────────────────────────────────────────────

  const handleBaixarModelo = async () => {
    try {
      const res = await movimentacoesAPI.templateHistoricoEntradas();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_historico_entradas.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErroImport('Erro ao baixar o modelo CSV');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setResultadoImport(null);
    setErroImport('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await movimentacoesAPI.previewHistoricoEntradas(formData);
      setPreviewEntradas(res.data);
    } catch (err) {
      setErroImport(err.response?.data?.detail || 'Erro ao processar o arquivo CSV');
      setSelectedFile(null);
    }
    e.target.value = '';
  };

  const handleConfirmarImportacao = async () => {
    if (!selectedFile) return;
    setImportando(true);
    setErroImport('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const res = await movimentacoesAPI.importarHistoricoEntradas(formData);
      setResultadoImport(res.data);
      setPreviewEntradas(null);
      setSelectedFile(null);
    } catch (err) {
      setErroImport(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setImportando(false);
    }
  };

  const handleCancelarPreview = () => {
    setPreviewEntradas(null);
    setSelectedFile(null);
    setErroImport('');
  };

  // labels legíveis para os campos do mapeamento
  const FIELD_LABELS = {
    data: 'Data',
    nf: 'Nº NF',
    codigo_item: 'Código do Item',
    grade: 'Grade',
    titulo: 'Título',
    valor_unitario: 'Valor Unitário',
    quantidade: 'Quantidade',
    valor_total: 'Valor Total',
    observacao: 'Observação',
  };

  return (
    <div className="movimentacoes">
      <h1>Movimentações</h1>

      <div className="secao-tabs">
        <button className={`secao-tab ${secao === 'registrar' ? 'active' : ''}`} onClick={() => setSecao('registrar')}>
          Registrar
        </button>
        <button className={`secao-tab ${secao === 'historico' ? 'active' : ''}`} onClick={() => setSecao('historico')}>
          Histórico
        </button>
      </div>

      {secao === 'registrar' && (
        <div className="form-container">
          <div className="registrar-header">
            <div className="tabs">
              <button className={`tab ${tipo === 'venda' ? 'active' : ''}`} onClick={() => setTipo('venda')}>
                Venda
              </button>
              <button className={`tab ${tipo === 'compra' ? 'active' : ''}`} onClick={() => setTipo('compra')}>
                Compra
              </button>
            </div>

            {isAdmin && tipo === 'compra' && (
              <div className="csv-dropdown" ref={csvMenuRef}>
                <button
                  className="btn-secondary"
                  onClick={() => setCsvMenuAberto((v) => !v)}
                  disabled={importando}
                >
                  {importando ? 'Importando...' : 'Importar Histórico CSV ▾'}
                </button>
                {csvMenuAberto && (
                  <div className="csv-menu">
                    <button onClick={() => { handleBaixarModelo(); setCsvMenuAberto(false); }}>
                      Baixar Modelo
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setCsvMenuAberto(false); }}>
                      Importar CSV
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
          </div>

          {erroImport && <div className="alert-error">{erroImport}</div>}

          {resultadoImport && (
            <div className={`import-result ${resultadoImport.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
              <strong>Importação concluída:</strong> {resultadoImport.importados} entrada(s) registrada(s).
              {resultadoImport.avisos?.length > 0 && (
                <>
                  <br /><strong>Avisos:</strong>
                  <ul>{resultadoImport.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </>
              )}
              {resultadoImport.erros?.length > 0 && (
                <>
                  <br /><strong>Erros:</strong>
                  <ul>{resultadoImport.erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </>
              )}
              <button className="btn-close-result" onClick={() => setResultadoImport(null)}>✕</button>
            </div>
          )}

          {previewEntradas && (
            <div className="preview-section">
              <h2>Pré-visualização — Histórico de Entradas</h2>

              {previewEntradas.warnings?.length > 0 && (
                <div className="warnings">
                  <strong>Avisos:</strong>
                  <ul>{previewEntradas.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              <div className="mapping-info">
                <h3>Mapeamento de Colunas:</h3>
                <div className="mapping-grid">
                  {Object.entries(previewEntradas.column_mapping).map(([field, colName]) => (
                    <div key={field} className={`mapping-item ${colName ? 'mapped' : 'unmapped'}`}>
                      <strong>{FIELD_LABELS[field] || field}:</strong> {colName || 'Não encontrado'}
                    </div>
                  ))}
                </div>
              </div>

              {previewEntradas.mapped_preview?.length > 0 && (
                <div className="preview-table">
                  <h3>Primeiras {previewEntradas.mapped_preview.length} linha(s) processadas:</h3>
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(previewEntradas.mapped_preview[0]).map((f) => (
                          <th key={f}>{FIELD_LABELS[f] || f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewEntradas.mapped_preview.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, ci) => (
                            <td
                              key={ci}
                              className={typeof val === 'string' && val.startsWith('Erro:') ? 'error-cell' : ''}
                            >
                              {val === null || val === undefined ? '-' : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="preview-actions">
                <button className="btn-primary" onClick={handleConfirmarImportacao} disabled={importando}>
                  {importando ? 'Importando...' : 'Confirmar Importação'}
                </button>
                <button className="btn-secondary" onClick={handleCancelarPreview}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="form">
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="busca-livro">ID do Livro</label>
              <input
                id="busca-livro"
                type="text"
                value={buscaLivro}
                onChange={(e) => { setBuscaLivro(e.target.value); setLivroSelecionado(null); }}
                placeholder="Digite o título para buscar..."
                required
              />
              {resultadosBusca.length > 0 && (
                <ul className="autocomplete">
                  {resultadosBusca.map((l) => (
                    <li key={l.id} onClick={() => selecionarLivro(l)}>
                      <strong>{l.titulo}</strong> <span>— {l.autor}</span>
                    </li>
                  ))}
                </ul>
              )}
              {livroSelecionado && (
                <span className="livro-selecionado">✓ ID {livroSelecionado.id}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="quantidade">Quantidade</label>
              <input id="quantidade" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="1" required />
            </div>

            {tipo === 'compra' && (
              <>
                <div className="form-group">
                  <label htmlFor="preco-unitario">Preço Unitário</label>
                  <input id="preco-unitario" type="text" inputMode="decimal" placeholder="R$ 0,00" value={precoUnitario} onChange={(e) => setPrecoUnitario(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="numero-lote">Número do Lote</label>
                  <input id="numero-lote" type="text" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="fornecedor">Fornecedor</label>
                  <input id="fornecedor" type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
                </div>
              </>
            )}

            {message && <div className="success">{message}</div>}
            {error && <div className="error">{error}</div>}

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Processando...' : `Registrar ${tipo}`}
            </button>
          </form>
        </div>
      )}

      {secao === 'historico' && (
        <div className="historico">
          <div className="historico-filtros">
            <div className="form-group">
              <label>Data início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Data fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <button className="submit-btn" style={{ alignSelf: 'flex-end', padding: '0.6rem 1.2rem' }} onClick={carregarHistorico}>
              Filtrar
            </button>
          </div>

          {loadingHistorico ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Carregando...</p>
          ) : historico.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Nenhuma movimentação encontrada</p>
          ) : (
            <div className="historico-table-wrapper">
              <table className="historico-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Livro</th>
                    <th>Qtd.</th>
                    <th>Preço Unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m, i) => (
                    <tr key={i}>
                      <td>{new Date(m.data_movimento).toLocaleString('pt-BR')}</td>
                      <td>
                        <span className={`badge-tipo ${m.tipo}`}>{m.tipo}</span>
                      </td>
                      <td>{m.titulo || m.livro_id}</td>
                      <td>{m.quantidade}</td>
                      <td>{m.preco_unitario ? `R$ ${parseFloat(m.preco_unitario).toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
