import { useState, useEffect } from 'react';
import { livrosAPI, movimentacoesAPI, relatoriosAPI } from '../api/endpoints';
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
          parseFloat(precoUnitario), numeroLote, fornecedor
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
          <div className="tabs">
            <button className={`tab ${tipo === 'venda' ? 'active' : ''}`} onClick={() => setTipo('venda')}>
              Venda
            </button>
            <button className={`tab ${tipo === 'compra' ? 'active' : ''}`} onClick={() => setTipo('compra')}>
              Compra
            </button>
          </div>

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
                  <input id="preco-unitario" type="number" step="0.01" value={precoUnitario} onChange={(e) => setPrecoUnitario(e.target.value)} required />
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
