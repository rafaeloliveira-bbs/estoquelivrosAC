import { useState, useEffect, useRef } from 'react';
import { livrosAPI, movimentacoesAPI, relatoriosAPI, filiaisAPI } from '../api/endpoints';
import { getUserRole } from '../utils/auth';
import { parseMoeda, formatMoedaBR } from '../utils/moeda';
import './Movimentacoes.css';

const MOEDA_FIELDS = new Set(['valor_unitario', 'valor_total']);

const FIELD_LABELS = {
  data: 'Data',
  nf: 'Nº NF',
  codigo_item: 'Item',
  grade: 'Grade',
  titulo: 'Título',
  valor_unitario: 'Valor Unit.',
  quantidade: 'Qnt',
  valor_total: 'Valor Total',
  observacao: 'Observações',
  filial_id: 'ID Filial',
};

const hoje = () => new Date().toLocaleDateString('en-CA');

export default function Movimentacoes() {
  const [secao, setSecao] = useState('registrar');

  // ── Compra form ──────────────────────────────────────────────────────────────
  const [dataCompra, setDataCompra] = useState(hoje());
  const [nfCompra, setNfCompra] = useState('');
  const [codigoCompra, setCodigoCompra] = useState('');
  const [gradeCompra, setGradeCompra] = useState('');
  const [tituloCompra, setTituloCompra] = useState('');
  const [valorUnitCompra, setValorUnitCompra] = useState('');
  const [qtdCompra, setQtdCompra] = useState('');
  const [obsCompra, setObsCompra] = useState('');
  const [livroIdCompra, setLivroIdCompra] = useState(null);
  const [loadingCompra, setLoadingCompra] = useState(false);
  const [msgCompra, setMsgCompra] = useState('');
  const [errCompra, setErrCompra] = useState('');
  const [lookupErrCompra, setLookupErrCompra] = useState('');

  // ── Venda form ───────────────────────────────────────────────────────────────
  const [dataVenda, setDataVenda] = useState(hoje());
  const [obsVenda, setObsVenda] = useState('');
  const [codigoVenda, setCodigoVenda] = useState('');
  const [tituloVenda, setTituloVenda] = useState('');
  const [valorUnitVenda, setValorUnitVenda] = useState('');
  const [qtdVenda, setQtdVenda] = useState('');
  const [livroIdVenda, setLivroIdVenda] = useState(null);
  const [loadingVenda, setLoadingVenda] = useState(false);
  const [msgVenda, setMsgVenda] = useState('');
  const [errVenda, setErrVenda] = useState('');
  const [lookupErrVenda, setLookupErrVenda] = useState('');

  // ── Histórico ────────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoHistorico, setTipoHistorico] = useState('');
  const [filialHistorico, setFilialHistorico] = useState('');
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [limpandoHistorico, setLimpandoHistorico] = useState(false);
  const [msgLimpar, setMsgLimpar] = useState('');

  // ── CSV import – Entradas ────────────────────────────────────────────────────
  const isAdmin = getUserRole() === 'admin' || getUserRole() === 'gestor';
  const fileInputRef = useRef(null);
  const csvMenuRef = useRef(null);
  const [csvMenuAberto, setCsvMenuAberto] = useState(false);
  const [previewEntradas, setPreviewEntradas] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [erroImport, setErroImport] = useState('');

  // ── Lista de filiais (para seletor no import de saídas) ──────────────────────
  const [filiais, setFiliais] = useState([]);
  useEffect(() => {
    filiaisAPI.listar().then((r) => setFiliais(r.data)).catch(() => {});
  }, []);

  // ── CSV import – Saídas ──────────────────────────────────────────────────────
  const [filialEntradasId, setFilialEntradasId] = useState('');
  const [filialSaidasId, setFilialSaidasId] = useState('');
  const fileInputSaidasRef = useRef(null);
  const csvMenuSaidasRef = useRef(null);
  const [csvMenuSaidasAberto, setCsvMenuSaidasAberto] = useState(false);
  const [previewSaidas, setPreviewSaidas] = useState(null);
  const [selectedFileSaidas, setSelectedFileSaidas] = useState(null);
  const [importandoSaidas, setImportandoSaidas] = useState(false);
  const [resultadoImportSaidas, setResultadoImportSaidas] = useState(null);
  const [erroImportSaidas, setErroImportSaidas] = useState('');

  useEffect(() => {
    const fechar = (e) => {
      if (csvMenuRef.current && !csvMenuRef.current.contains(e.target)) {
        setCsvMenuAberto(false);
      }
      if (csvMenuSaidasRef.current && !csvMenuSaidasRef.current.contains(e.target)) {
        setCsvMenuSaidasAberto(false);
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  // ── Limpeza de histórico importado ───────────────────────────────────────────
  const limparHistorico = async (tipo) => {
    const label = tipo === 'entradas' ? 'entradas' : tipo === 'saidas' ? 'saídas' : 'entradas e saídas';
    if (!window.confirm(`Remover todos os registros históricos importados de ${label}?\n\nISSO NÃO PODE SER DESFEITO. Movimentações registradas manualmente não serão afetadas.`)) return;
    setLimpandoHistorico(true);
    setMsgLimpar('');
    try {
      const res = await movimentacoesAPI.limparHistorico(filialHistorico || undefined, tipo);
      setMsgLimpar(`${res.data.removidos} registro(s) removido(s).`);
      carregarHistorico();
    } catch {
      setMsgLimpar('Erro ao limpar histórico.');
    } finally {
      setLimpandoHistorico(false);
    }
  };

  // ── Histórico loader ─────────────────────────────────────────────────────────
  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const res = await relatoriosAPI.movimentacoes(
        dataInicio || undefined,
        dataFim || undefined,
        tipoHistorico || undefined,
        filialHistorico || undefined,
      );
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

  // ── Lookup por código de item ─────────────────────────────────────────────────
  const buscarLivro = async (codigo, setId, setTitulo, setGrade, setLookupErr) => {
    const n = parseInt(codigo);
    if (!n) return;
    setLookupErr('');
    try {
      const res = await livrosAPI.porCodigo(n);
      setId(res.data.id);
      setTitulo(res.data.titulo || '');
      if (setGrade) setGrade(res.data.grade || '');
    } catch {
      setId(null);
      setTitulo('');
      if (setGrade) setGrade('');
      setLookupErr('Item não encontrado');
    }
  };

  // ── Valor total calculado ────────────────────────────────────────────────────
  const totalCompra = (parseMoeda(valorUnitCompra) || 0) * (parseInt(qtdCompra) || 0);
  const totalVenda = (parseMoeda(valorUnitVenda) || 0) * (parseInt(qtdVenda) || 0);

  // ── Submit compra ────────────────────────────────────────────────────────────
  const handleSubmitCompra = async (e) => {
    e.preventDefault();
    if (!livroIdCompra) { setErrCompra('Pesquise um item pelo código antes de registrar'); return; }
    setLoadingCompra(true);
    setMsgCompra(''); setErrCompra('');
    try {
      await movimentacoesAPI.registrarCompra(
        livroIdCompra,
        parseInt(qtdCompra),
        parseMoeda(valorUnitCompra),
        nfCompra || null,
        null,
        obsCompra || null,
        dataCompra,
      );
      setMsgCompra('Compra registrada com sucesso!');
      setCodigoCompra(''); setGradeCompra(''); setTituloCompra('');
      setNfCompra(''); setValorUnitCompra(''); setQtdCompra('');
      setObsCompra(''); setLivroIdCompra(null);
      setDataCompra(hoje());
    } catch (err) {
      setErrCompra(err.response?.data?.detail || 'Erro ao registrar compra');
    } finally {
      setLoadingCompra(false);
    }
  };

  // ── Submit venda ─────────────────────────────────────────────────────────────
  const handleSubmitVenda = async (e) => {
    e.preventDefault();
    if (!livroIdVenda) { setErrVenda('Pesquise um item pelo código antes de registrar'); return; }
    setLoadingVenda(true);
    setMsgVenda(''); setErrVenda('');
    try {
      await movimentacoesAPI.registrarVenda(
        livroIdVenda,
        parseInt(qtdVenda),
        parseMoeda(valorUnitVenda),
        dataVenda,
        null,
        null,
        obsVenda || null,
      );
      setMsgVenda('Venda registrada com sucesso!');
      setCodigoVenda(''); setTituloVenda('');
      setValorUnitVenda(''); setQtdVenda('');
      setObsVenda(''); setLivroIdVenda(null);
      setDataVenda(hoje());
    } catch (err) {
      setErrVenda(err.response?.data?.detail || 'Erro ao registrar venda');
    } finally {
      setLoadingVenda(false);
    }
  };

  // ── CSV import handlers ──────────────────────────────────────────────────────
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
      const res = await movimentacoesAPI.importarHistoricoEntradas(formData, filialEntradasId || undefined);
      setResultadoImport(res.data);
      setPreviewEntradas(null);
      setSelectedFile(null);
      setFilialEntradasId('');
      setDataInicio('');
      setDataFim('');
      setSecao('historico');
    } catch (err) {
      setErroImport(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setImportando(false);
    }
  };

  const handleCancelarPreview = () => {
    setPreviewEntradas(null);
    setSelectedFile(null);
    setFilialEntradasId('');
    setErroImport('');
  };

  // ── CSV saídas handlers ──────────────────────────────────────────────────────
  const handleBaixarModeloSaidas = async () => {
    try {
      const res = await movimentacoesAPI.templateHistoricoSaidas();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_historico_saidas.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErroImportSaidas('Erro ao baixar o modelo CSV');
    }
  };

  const handleFileSelectSaidas = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileSaidas(file);
    setResultadoImportSaidas(null);
    setErroImportSaidas('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await movimentacoesAPI.previewHistoricoSaidas(formData);
      setPreviewSaidas(res.data);
    } catch (err) {
      setErroImportSaidas(err.response?.data?.detail || 'Erro ao processar o arquivo CSV');
      setSelectedFileSaidas(null);
    }
    e.target.value = '';
  };

  const handleConfirmarImportacaoSaidas = async () => {
    if (!selectedFileSaidas) return;
    setImportandoSaidas(true);
    setErroImportSaidas('');
    const formData = new FormData();
    formData.append('file', selectedFileSaidas);
    try {
      const res = await movimentacoesAPI.importarHistoricoSaidas(formData, filialSaidasId || undefined);
      setResultadoImportSaidas(res.data);
      setPreviewSaidas(null);
      setSelectedFileSaidas(null);
      setFilialSaidasId('');
      setDataInicio('');
      setDataFim('');
      setSecao('historico');
    } catch (err) {
      setErroImportSaidas(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setImportandoSaidas(false);
    }
  };

  const handleCancelarPreviewSaidas = () => {
    setPreviewSaidas(null);
    setSelectedFileSaidas(null);
    setFilialSaidasId('');
    setErroImportSaidas('');
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
          {erroImport && <div className="alert-error">{erroImport}</div>}
          {erroImportSaidas && <div className="alert-error">{erroImportSaidas}</div>}

          {resultadoImport && (
            <div className={`import-result ${resultadoImport.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
              <strong>Importação de entradas concluída:</strong> {resultadoImport.importados} registro(s).
              {resultadoImport.avisos?.length > 0 && (
                <><br /><strong>Avisos:</strong><ul>{resultadoImport.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></>
              )}
              {resultadoImport.erros?.length > 0 && (
                <><br /><strong>Erros:</strong><ul>{resultadoImport.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></>
              )}
              <button className="btn-close-result" onClick={() => setResultadoImport(null)}>✕</button>
            </div>
          )}

          {resultadoImportSaidas && (
            <div className={`import-result ${resultadoImportSaidas.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
              <strong>Importação de saídas concluída:</strong> {resultadoImportSaidas.importados} registro(s).
              {resultadoImportSaidas.avisos?.length > 0 && (
                <><br /><strong>Avisos:</strong><ul>{resultadoImportSaidas.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></>
              )}
              {resultadoImportSaidas.erros?.length > 0 && (
                <><br /><strong>Erros:</strong><ul>{resultadoImportSaidas.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></>
              )}
              <button className="btn-close-result" onClick={() => setResultadoImportSaidas(null)}>✕</button>
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
                            <td key={ci} className={typeof val === 'string' && val.startsWith('Erro:') ? 'error-cell' : ''}>
                              {val === null || val === undefined
                                ? '-'
                                : MOEDA_FIELDS.has(Object.keys(previewEntradas.mapped_preview[0])[ci]) && typeof val === 'number'
                                  ? `R$ ${formatMoedaBR(val)}`
                                  : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="filial-seletor">
                <label htmlFor="filial-entradas">Filial vinculada às entradas *</label>
                <select
                  id="filial-entradas"
                  value={filialEntradasId}
                  onChange={(e) => setFilialEntradasId(e.target.value)}
                  required
                >
                  <option value="">— Selecione a filial —</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id} — {f.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="preview-actions">
                <button className="btn-primary" onClick={handleConfirmarImportacao} disabled={importando || !filialEntradasId}>
                  {importando ? 'Importando...' : 'Confirmar Importação'}
                </button>
                <button className="btn-secondary" onClick={handleCancelarPreview}>Cancelar</button>
              </div>
            </div>
          )}

          {previewSaidas && (
            <div className="preview-section">
              <h2>Pré-visualização — Histórico de Saídas</h2>
              {previewSaidas.warnings?.length > 0 && (
                <div className="warnings">
                  <strong>Avisos:</strong>
                  <ul>{previewSaidas.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              <div className="mapping-info">
                <h3>Mapeamento de Colunas:</h3>
                <div className="mapping-grid">
                  {Object.entries(previewSaidas.column_mapping).map(([field, colName]) => (
                    <div key={field} className={`mapping-item ${colName ? 'mapped' : 'unmapped'}`}>
                      <strong>{FIELD_LABELS[field] || field}:</strong> {colName || 'Não encontrado'}
                    </div>
                  ))}
                </div>
              </div>
              {previewSaidas.mapped_preview?.length > 0 && (
                <div className="preview-table">
                  <h3>Primeiras {previewSaidas.mapped_preview.length} linha(s) processadas:</h3>
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(previewSaidas.mapped_preview[0]).map((f) => (
                          <th key={f}>{FIELD_LABELS[f] || f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewSaidas.mapped_preview.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, ci) => (
                            <td key={ci} className={typeof val === 'string' && val.startsWith('Erro:') ? 'error-cell' : ''}>
                              {val === null || val === undefined
                                ? '-'
                                : MOEDA_FIELDS.has(Object.keys(previewSaidas.mapped_preview[0])[ci]) && typeof val === 'number'
                                  ? `R$ ${formatMoedaBR(val)}`
                                  : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="filial-seletor">
                <label htmlFor="filial-saidas">Filial vinculada às saídas *</label>
                <select
                  id="filial-saidas"
                  value={filialSaidasId}
                  onChange={(e) => setFilialSaidasId(e.target.value)}
                  required
                >
                  <option value="">— Selecione a filial —</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id} — {f.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="preview-actions">
                <button
                  className="btn-primary"
                  onClick={handleConfirmarImportacaoSaidas}
                  disabled={importandoSaidas || !filialSaidasId}
                >
                  {importandoSaidas ? 'Importando...' : 'Confirmar Importação'}
                </button>
                <button className="btn-secondary" onClick={handleCancelarPreviewSaidas}>Cancelar</button>
              </div>
            </div>
          )}

          {!previewEntradas && !previewSaidas && (
            <div className="registrar-grid">
              {/* ── COMPRA ── */}
              <div className="registrar-col">
                <div className="registrar-col-header">
                  <h2>Compra</h2>
                  {isAdmin && (
                    <div className="csv-dropdown" ref={csvMenuRef}>
                      <button
                        className="btn-secondary"
                        onClick={() => setCsvMenuAberto((v) => !v)}
                        disabled={importando}
                      >
                        {importando ? 'Importando...' : 'Importar CSV ▾'}
                      </button>
                      {csvMenuAberto && (
                        <div className="csv-menu">
                          <button onClick={() => { handleBaixarModelo(); setCsvMenuAberto(false); }}>Baixar Modelo</button>
                          <button onClick={() => { fileInputRef.current?.click(); setCsvMenuAberto(false); }}>Importar CSV</button>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileSelect} />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitCompra} className="form">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Data</label>
                      <input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>Nº NF</label>
                      <input type="text" value={nfCompra} onChange={(e) => setNfCompra(e.target.value)} placeholder="Número da nota" />
                    </div>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Código do Item</label>
                    <input
                      type="text"
                      value={codigoCompra}
                      onChange={(e) => {
                        setCodigoCompra(e.target.value);
                        setLivroIdCompra(null);
                        setTituloCompra('');
                        setGradeCompra('');
                        setLookupErrCompra('');
                      }}
                      onBlur={() => buscarLivro(codigoCompra, setLivroIdCompra, setTituloCompra, setGradeCompra, setLookupErrCompra)}
                      placeholder="Ex: 1001"
                      required
                    />
                    {lookupErrCompra && <span className="lookup-err">{lookupErrCompra}</span>}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Grade</label>
                      <input type="text" value={gradeCompra} readOnly placeholder="—" className="input-readonly" />
                    </div>
                    <div className="form-group">
                      <label>Título</label>
                      <input type="text" value={tituloCompra} readOnly placeholder="—" className="input-readonly" />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Valor Unit.</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={valorUnitCompra}
                        onChange={(e) => setValorUnitCompra(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantidade</label>
                      <input type="number" min="1" value={qtdCompra} onChange={(e) => setQtdCompra(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>Valor Total</label>
                      <input type="text" value={totalCompra > 0 ? `R$ ${formatMoedaBR(totalCompra)}` : ''} readOnly placeholder="—" className="input-readonly" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Observação</label>
                    <input type="text" value={obsCompra} onChange={(e) => setObsCompra(e.target.value)} placeholder="Opcional" />
                  </div>

                  {msgCompra && <div className="success">{msgCompra}</div>}
                  {errCompra && <div className="error">{errCompra}</div>}

                  <button type="submit" disabled={loadingCompra} className="submit-btn">
                    {loadingCompra ? 'Processando...' : 'Registrar Compra'}
                  </button>
                </form>
              </div>

              {/* ── VENDA ── */}
              <div className="registrar-col">
                <div className="registrar-col-header">
                  <h2>Venda</h2>
                  {isAdmin && (
                    <div className="csv-dropdown" ref={csvMenuSaidasRef}>
                      <button
                        className="btn-secondary"
                        onClick={() => setCsvMenuSaidasAberto((v) => !v)}
                        disabled={importandoSaidas}
                      >
                        {importandoSaidas ? 'Importando...' : 'Importar CSV ▾'}
                      </button>
                      {csvMenuSaidasAberto && (
                        <div className="csv-menu">
                          <button onClick={() => { handleBaixarModeloSaidas(); setCsvMenuSaidasAberto(false); }}>Baixar Modelo</button>
                          <button onClick={() => { fileInputSaidasRef.current?.click(); setCsvMenuSaidasAberto(false); }}>Importar CSV</button>
                        </div>
                      )}
                      <input ref={fileInputSaidasRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileSelectSaidas} />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitVenda} className="form">
                  <div className="form-group">
                    <label>Data</label>
                    <input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} required />
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Código do Item</label>
                    <input
                      type="text"
                      value={codigoVenda}
                      onChange={(e) => {
                        setCodigoVenda(e.target.value);
                        setLivroIdVenda(null);
                        setTituloVenda('');
                        setLookupErrVenda('');
                      }}
                      onBlur={() => buscarLivro(codigoVenda, setLivroIdVenda, setTituloVenda, null, setLookupErrVenda)}
                      placeholder="Ex: 1001"
                      required
                    />
                    {lookupErrVenda && <span className="lookup-err">{lookupErrVenda}</span>}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Título</label>
                      <input type="text" value={tituloVenda} readOnly placeholder="—" className="input-readonly" />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Valor Unit.</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={valorUnitVenda}
                        onChange={(e) => setValorUnitVenda(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantidade</label>
                      <input type="number" min="1" value={qtdVenda} onChange={(e) => setQtdVenda(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>Valor Total</label>
                      <input type="text" value={totalVenda > 0 ? `R$ ${formatMoedaBR(totalVenda)}` : ''} readOnly placeholder="—" className="input-readonly" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Observação</label>
                    <input type="text" value={obsVenda} onChange={(e) => setObsVenda(e.target.value)} placeholder="Opcional" />
                  </div>

                  {msgVenda && <div className="success">{msgVenda}</div>}
                  {errVenda && <div className="error">{errVenda}</div>}

                  <button type="submit" disabled={loadingVenda} className="submit-btn">
                    {loadingVenda ? 'Processando...' : 'Registrar Venda'}
                  </button>
                </form>
              </div>
            </div>
          )}
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
            <div className="form-group">
              <label>Tipo</label>
              <select value={tipoHistorico} onChange={(e) => setTipoHistorico(e.target.value)}>
                <option value="">Todos</option>
                <option value="compra">Compra</option>
                <option value="venda">Venda</option>
                <option value="devolucao">Devolução</option>
                <option value="ajuste">Ajuste</option>
                <option value="emprestimo">Empréstimo</option>
              </select>
            </div>
            {isAdmin && (
              <div className="form-group">
                <label>Filial</label>
                <select value={filialHistorico} onChange={(e) => setFilialHistorico(e.target.value)}>
                  <option value="">Todas</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="submit-btn" style={{ alignSelf: 'flex-end', padding: '0.6rem 1.2rem' }} onClick={carregarHistorico}>
              Filtrar
            </button>
            {getUserRole() === 'admin' && (
              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-danger-outline"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                  disabled={limpandoHistorico}
                  onClick={() => limparHistorico('entradas')}
                  title="Remove todos os registros de compra importados via CSV (lote_id=NULL)"
                >
                  Limpar entradas importadas
                </button>
                <button
                  className="btn-danger-outline"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                  disabled={limpandoHistorico}
                  onClick={() => limparHistorico('saidas')}
                  title="Remove todos os registros de venda importados via CSV (lote_id=NULL)"
                >
                  Limpar saídas importadas
                </button>
              </div>
            )}
          </div>
          {msgLimpar && (
            <p style={{ color: msgLimpar.startsWith('Erro') ? '#e53e3e' : '#38a169', margin: '0.5rem 0', fontSize: '0.9rem' }}>
              {msgLimpar}
            </p>
          )}

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
                      <td>{m.data}</td>
                      <td>
                        <span className={`badge-tipo ${m.tipo?.toLowerCase()}`}>{m.tipo}</span>
                      </td>
                      <td>{m.livro_titulo}</td>
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
