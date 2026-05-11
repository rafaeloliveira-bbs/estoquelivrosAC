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

  // ── NF PDF import ────────────────────────────────────────────────────────────
  const fileInputNfRef = useRef(null);
  const [filialNfId, setFilialNfId] = useState('');
  const [tipoNf, setTipoNf] = useState('compra');
  const [previewNf, setPreviewNf] = useState(null);
  const [itensNf, setItensNf] = useState([]);
  const [livrosFilial, setLivrosFilial] = useState([]);
  const [vinculandoIdx, setVinculandoIdx] = useState(null);
  const [buscaVinculacao, setBuscaVinculacao] = useState('');
  const [importandoNf, setImportandoNf] = useState(false);
  const [resultadoImportNf, setResultadoImportNf] = useState(null);
  const [erroImportNf, setErroImportNf] = useState('');

  // ── Cadastro rápido de livro via NF ──────────────────────────────────────────
  const [cadastroRapidoIdx, setCadastroRapidoIdx] = useState(null);
  const [formCadastroRapido, setFormCadastroRapido] = useState({});
  const [salvandoCadastroRapido, setSalvandoCadastroRapido] = useState(false);
  const [erroCadastroRapido, setErroCadastroRapido] = useState('');

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

  // ── NF PDF handlers ──────────────────────────────────────────────────────────
  const handleFileSelectNf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultadoImportNf(null);
    setErroImportNf('');
    setImportandoNf(true);
    const formData = new FormData();
    formData.append('file', file);
    const [previewResult, livrosResult] = await Promise.allSettled([
      movimentacoesAPI.previewNfPdf(formData, filialNfId),
      livrosAPI.listarComEstoque(null, parseInt(filialNfId), 0, 2000),
    ]);
    setImportandoNf(false);
    if (previewResult.status === 'rejected') {
      setErroImportNf(previewResult.reason?.response?.data?.detail || 'Erro ao processar o PDF da NF');
      e.target.value = '';
      return;
    }
    setPreviewNf(previewResult.value.data);
    setItensNf(previewResult.value.data.itens);
    if (livrosResult.status === 'fulfilled') setLivrosFilial(livrosResult.value.data);
    e.target.value = '';
  };

  const handleSelectLivroNf = (index, livro) => {
    setItensNf((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, livro_id: livro.id, codigo_item: livro.codigo_item, titulo_cadastro: livro.titulo, match_encontrado: true }
          : item
      )
    );
    setBuscasNf((prev) => ({ ...prev, [index]: '' }));
  };

  const handleConfirmarImportacaoNf = async () => {
    if (!previewNf) return;
    const itensComMatch = itensNf.filter((i) => i.match_encontrado);
    if (itensComMatch.length === 0) return;
    setImportandoNf(true);
    setErroImportNf('');
    try {
      const res = await movimentacoesAPI.importarNfPdf({
        data: previewNf.data,
        numero_nf: previewNf.numero_nf,
        tipo: tipoNf,
        filial_id: parseInt(filialNfId),
        itens: itensComMatch.map((i) => ({
          livro_id: i.livro_id,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
        })),
      });
      setResultadoImportNf(res.data);
      setPreviewNf(null);
      setItensNf([]);
      setLivrosFilial([]);
      setVinculandoIdx(null);
      setBuscaVinculacao('');
      setFilialNfId('');
      setTipoNf('compra');
      setDataInicio('');
      setDataFim('');
      setSecao('historico');
    } catch (err) {
      setErroImportNf(err.response?.data?.detail || 'Erro ao importar NF');
    } finally {
      setImportandoNf(false);
    }
  };

  const handleCancelarPreviewNf = () => {
    setPreviewNf(null);
    setItensNf([]);
    setLivrosFilial([]);
    setVinculandoIdx(null);
    setBuscaVinculacao('');
    setErroImportNf('');
  };

  // ── Cadastro rápido ──────────────────────────────────────────────────────────
  const abrirCadastroRapido = (idx) => {
    const item = itensNf[idx];
    setCadastroRapidoIdx(idx);
    setFormCadastroRapido({
      titulo: item.titulo_nf || '',
      preco_custo: item.valor_unitario != null ? String(item.valor_unitario) : '',
      codigo_item: '',
      isbn: '',
      autor: '',
      editora: '',
      fornecedor: '',
      grade: '',
      classificacao: '',
      tipo_material: '',
    });
    setErroCadastroRapido('');
  };

  const fecharCadastroRapido = () => {
    setCadastroRapidoIdx(null);
    setFormCadastroRapido({});
    setErroCadastroRapido('');
  };

  const abrirVinculacao = (idx) => {
    setVinculandoIdx(idx);
    setBuscaVinculacao('');
  };

  const fecharVinculacao = () => {
    setVinculandoIdx(null);
    setBuscaVinculacao('');
  };

  const handleChangeCadastroRapido = (e) => {
    const { name, value } = e.target;
    setFormCadastroRapido((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalvarCadastroRapido = async (e) => {
    e.preventDefault();
    setSalvandoCadastroRapido(true);
    setErroCadastroRapido('');
    try {
      const payload = {
        titulo: formCadastroRapido.titulo,
        filial_id: parseInt(filialNfId),
        preco_custo: parseFloat(formCadastroRapido.preco_custo) || 0,
      };
      if (formCadastroRapido.codigo_item) payload.codigo_item = parseInt(formCadastroRapido.codigo_item);
      if (formCadastroRapido.isbn)          payload.isbn = formCadastroRapido.isbn;
      if (formCadastroRapido.autor)         payload.autor = formCadastroRapido.autor;
      if (formCadastroRapido.editora)       payload.editora = formCadastroRapido.editora;
      if (formCadastroRapido.fornecedor)    payload.fornecedor = formCadastroRapido.fornecedor;
      if (formCadastroRapido.grade)         payload.grade = formCadastroRapido.grade;
      if (formCadastroRapido.classificacao) payload.classificacao = formCadastroRapido.classificacao;
      if (formCadastroRapido.tipo_material) payload.tipo_material = formCadastroRapido.tipo_material;

      const res = await livrosAPI.criar(payload);
      const novoLivro = res.data;
      setLivrosFilial((prev) => [...prev, novoLivro]);
      handleSelectLivroNf(cadastroRapidoIdx, novoLivro);
      fecharCadastroRapido();
    } catch (err) {
      setErroCadastroRapido(err.response?.data?.detail || 'Erro ao cadastrar item');
    } finally {
      setSalvandoCadastroRapido(false);
    }
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

          {resultadoImportNf && (
            <div className={`import-result ${resultadoImportNf.erros?.length ? 'import-result--warn' : 'import-result--ok'}`}>
              <strong>Importação de NF concluída:</strong> {resultadoImportNf.importados} registro(s).
              {resultadoImportNf.erros?.length > 0 && (
                <><br /><strong>Erros:</strong><ul>{resultadoImportNf.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></>
              )}
              <button className="btn-close-result" onClick={() => setResultadoImportNf(null)}>✕</button>
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

          {previewNf && (
            <div className="preview-section">
              <h2>Pré-visualização — NF Nº {previewNf.numero_nf}</h2>
              <div className="nf-meta">
                <span><strong>Data de emissão:</strong> {previewNf.data}</span>
                <span><strong>Nº NF:</strong> {previewNf.numero_nf}</span>
              </div>
              {previewNf.avisos?.length > 0 && (
                <div className="warnings">
                  <strong>Avisos:</strong>
                  <ul>{previewNf.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              <div className="preview-table preview-table--nf">
                <table>
                  <thead>
                    <tr>
                      <th>Título (NF)</th>
                      <th>Item no cadastro</th>
                      <th>Qnt</th>
                      <th>Valor Unit.</th>
                      <th>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensNf.map((item, i) => (
                      <tr key={i}>
                        <td>{item.titulo_nf}</td>
                        <td>
                          {item.match_encontrado ? (
                            <div className="nf-match-ok-wrap">
                              <span className="nf-match-ok">
                                {item.codigo_item ? `${item.codigo_item} — ` : ''}{item.titulo_cadastro}
                              </span>
                              <button
                                type="button"
                                className="nf-match-desvincular"
                                title="Desvincular"
                                onClick={() =>
                                  setItensNf((prev) =>
                                    prev.map((it, idx) =>
                                      idx === i
                                        ? { ...it, match_encontrado: false, livro_id: null, titulo_cadastro: undefined }
                                        : it
                                    )
                                  )
                                }
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="nf-btn-vincular"
                              onClick={() => abrirVinculacao(i)}
                            >
                              Vincular item
                            </button>
                          )}
                        </td>
                        <td>{item.quantidade}</td>
                        <td>R$ {formatMoedaBR(item.valor_unitario)}</td>
                        <td>R$ {formatMoedaBR(item.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="nf-import-options">
                <div className="form-group">
                  <label htmlFor="tipo-nf">Tipo de movimentação *</label>
                  <select id="tipo-nf" value={tipoNf} onChange={(e) => setTipoNf(e.target.value)}>
                    <option value="compra">Compra</option>
                    <option value="venda">Venda</option>
                  </select>
                </div>
              </div>
              {erroImportNf && <div className="alert-error">{erroImportNf}</div>}
              <div className="preview-actions">
                <button
                  className="btn-primary"
                  onClick={handleConfirmarImportacaoNf}
                  disabled={importandoNf || itensNf.every((i) => !i.match_encontrado)}
                >
                  {importandoNf ? 'Importando...' : 'Confirmar Importação'}
                </button>
                <button className="btn-secondary" onClick={handleCancelarPreviewNf}>Cancelar</button>
              </div>
            </div>
          )}

          {!previewEntradas && !previewSaidas && !previewNf && isAdmin && (
            <div className="nf-pdf-bar">
              <span className="nf-pdf-label">Importar NF (PDF)</span>
              <select
                value={filialNfId}
                onChange={(e) => setFilialNfId(e.target.value)}
                className="nf-pdf-filial"
              >
                <option value="">— Filial —</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.id} — {f.nome}</option>
                ))}
              </select>
              <button
                className="btn-secondary"
                onClick={() => fileInputNfRef.current?.click()}
                disabled={!filialNfId || importandoNf}
              >
                {importandoNf ? 'Analisando...' : 'Selecionar PDF'}
              </button>
              <input
                ref={fileInputNfRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelectNf}
              />
              {erroImportNf && <span className="nf-pdf-erro">{erroImportNf}</span>}
            </div>
          )}

          {!previewEntradas && !previewSaidas && !previewNf && (
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

      {/* ── Modal: vinculação de item NF ao cadastro ─────────────────────── */}
      {vinculandoIdx !== null && itensNf[vinculandoIdx] && (
        <div className="nf-modal-overlay" onClick={fecharVinculacao}>
          <div className="nf-vincular-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nf-vincular-header">
              <div className="nf-vincular-header-text">
                <h2>Vincular ao cadastro</h2>
                <p className="nf-vincular-origem-titulo">{itensNf[vinculandoIdx].titulo_nf}</p>
              </div>
              <button className="btn-close" onClick={fecharVinculacao}>✕</button>
            </div>

            <div className="nf-vincular-busca-wrap">
              <input
                type="text"
                autoFocus
                className="nf-vincular-input"
                placeholder="Pesquisar por título ou código..."
                value={buscaVinculacao}
                onChange={(e) => setBuscaVinculacao(e.target.value)}
              />
            </div>

            <ul className="nf-vincular-lista">
              {(() => {
                const t = buscaVinculacao.toLowerCase();
                const lista = buscaVinculacao.length === 0
                  ? livrosFilial.slice(0, 40)
                  : livrosFilial
                      .filter((l) =>
                        (l.titulo ?? '').toLowerCase().includes(t) ||
                        String(l.codigo_item ?? '').includes(buscaVinculacao)
                      )
                      .slice(0, 40);
                if (lista.length === 0) {
                  return <li className="nf-vincular-vazio">Nenhum item encontrado</li>;
                }
                return lista.map((l) => (
                  <li
                    key={l.id}
                    onClick={() => {
                      handleSelectLivroNf(vinculandoIdx, l);
                      fecharVinculacao();
                    }}
                  >
                    {l.codigo_item && <strong>{l.codigo_item} —&nbsp;</strong>}
                    <span>{l.titulo}</span>
                  </li>
                ));
              })()}
            </ul>

            <div className="nf-vincular-footer">
              <button
                type="button"
                className="nf-btn-novo-item"
                onClick={() => {
                  fecharVinculacao();
                  abrirCadastroRapido(vinculandoIdx);
                }}
              >
                + Cadastrar novo item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: cadastro rápido de item via NF ────────────────────────── */}
      {cadastroRapidoIdx !== null && itensNf[cadastroRapidoIdx] && (
        <div className="nf-modal-overlay" onClick={fecharCadastroRapido}>
          <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nf-modal-header">
              <h2>Cadastrar novo item</h2>
              <button className="btn-close" onClick={fecharCadastroRapido}>✕</button>
            </div>

            <div className="nf-cadastro-origem">
              <span className="nf-cadastro-origem-label">Título na NF</span>
              <span className="nf-cadastro-origem-valor">{itensNf[cadastroRapidoIdx].titulo_nf}</span>
            </div>

            <form onSubmit={handleSalvarCadastroRapido} className="nf-cadastro-form">
              {erroCadastroRapido && <div className="alert-error">{erroCadastroRapido}</div>}

              <div className="nf-form-row">
                <div className="form-group">
                  <label>Título *</label>
                  <input
                    name="titulo"
                    value={formCadastroRapido.titulo || ''}
                    onChange={handleChangeCadastroRapido}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Código do item</label>
                  <input
                    name="codigo_item"
                    type="number"
                    value={formCadastroRapido.codigo_item || ''}
                    onChange={handleChangeCadastroRapido}
                    placeholder="ex: 1023"
                  />
                </div>
              </div>

              <div className="nf-form-row">
                <div className="form-group">
                  <label>Autor</label>
                  <input
                    name="autor"
                    value={formCadastroRapido.autor || ''}
                    onChange={handleChangeCadastroRapido}
                  />
                </div>
                <div className="form-group">
                  <label>Editora</label>
                  <input
                    name="editora"
                    value={formCadastroRapido.editora || ''}
                    onChange={handleChangeCadastroRapido}
                  />
                </div>
              </div>

              <div className="nf-form-row">
                <div className="form-group">
                  <label>Fornecedor</label>
                  <input
                    name="fornecedor"
                    value={formCadastroRapido.fornecedor || ''}
                    onChange={handleChangeCadastroRapido}
                  />
                </div>
                <div className="form-group">
                  <label>Grade</label>
                  <input
                    name="grade"
                    value={formCadastroRapido.grade || ''}
                    onChange={handleChangeCadastroRapido}
                    placeholder="ex: 1º ano"
                  />
                </div>
              </div>

              <div className="nf-form-row">
                <div className="form-group">
                  <label>ISBN</label>
                  <input
                    name="isbn"
                    value={formCadastroRapido.isbn || ''}
                    onChange={handleChangeCadastroRapido}
                    placeholder="978-..."
                  />
                </div>
                <div className="form-group">
                  <label>Preço de custo</label>
                  <input
                    name="preco_custo"
                    value={formCadastroRapido.preco_custo || ''}
                    onChange={handleChangeCadastroRapido}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="nf-form-row">
                <div className="form-group">
                  <label>Classificação</label>
                  <input
                    name="classificacao"
                    value={formCadastroRapido.classificacao || ''}
                    onChange={handleChangeCadastroRapido}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo de material</label>
                  <input
                    name="tipo_material"
                    value={formCadastroRapido.tipo_material || ''}
                    onChange={handleChangeCadastroRapido}
                  />
                </div>
              </div>

              <div className="nf-modal-actions">
                <button type="button" className="btn-secondary" onClick={fecharCadastroRapido}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvandoCadastroRapido}>
                  {salvandoCadastroRapido ? 'Cadastrando...' : 'Cadastrar e Vincular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
