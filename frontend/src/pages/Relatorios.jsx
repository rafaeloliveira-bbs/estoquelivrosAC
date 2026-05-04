import { useState, useEffect, useRef, Fragment } from 'react';
import { relatoriosAPI, filiaisAPI } from '../api/endpoints';
import { getUserRole } from '../utils/auth';
import './Relatorios.css';

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatMes(key) {
  const [ano, mes] = key.split('-');
  return `${MESES_PT[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
}

function formatValor(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Relatorios() {
  const isAdmin = getUserRole() === 'admin' || getUserRole() === 'gestor';
  const [filiais, setFiliais] = useState([]);
  const [filialId, setFilialId] = useState('');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  const wrapperRef = useRef(null);
  const topScrollRef = useRef(null);
  const topScrollInnerRef = useRef(null);

  useEffect(() => {
    if (isAdmin) filiaisAPI.listar().then(r => setFiliais(r.data)).catch(() => {});
  }, [isAdmin]);

  // Sincroniza largura da barra superior com o scrollWidth real da tabela
  useEffect(() => {
    if (!wrapperRef.current || !topScrollInnerRef.current) return;
    const sync = () => {
      topScrollInnerRef.current.style.width = wrapperRef.current.scrollWidth + 'px';
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [dados]);

  useEffect(() => {
    carregar();
  }, []);

  function carregar(fid) {
    setLoading(true);
    setErro('');
    relatoriosAPI.evolucaoEstoque(fid || undefined)
      .then(res => setDados(res.data))
      .catch(() => setErro('Erro ao carregar evolução de estoque'))
      .finally(() => setLoading(false));
  }

  const itens = dados?.itens ?? [];
  const meses = dados?.meses ?? [];

  const itensFiltrados = busca.trim()
    ? itens.filter(item =>
        item.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        String(item.codigo_item ?? '').includes(busca)
      )
    : itens;

  return (
    <div className="relatorios-page">
      <div className="evolucao-header">
        <h1>Evolução do Estoque</h1>
        {isAdmin && (
          <select
            className="evolucao-filial"
            value={filialId}
            onChange={e => {
              setFilialId(e.target.value);
              carregar(e.target.value);
            }}
          >
            <option value="">Minha filial</option>
            {filiais.map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        )}
        <input
          className="evolucao-busca"
          type="search"
          placeholder="Buscar por título ou código..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {loading && <div className="loading">Carregando dados...</div>}

      {!loading && !erro && (
        <>
          <p className="evolucao-info">
            {itensFiltrados.length} {itensFiltrados.length === 1 ? 'item' : 'itens'} · {meses.length} meses
          </p>

          <div
            ref={topScrollRef}
            className="evolucao-top-scroll"
            onScroll={() => { wrapperRef.current.scrollLeft = topScrollRef.current.scrollLeft; }}
          >
            <div ref={topScrollInnerRef} className="evolucao-top-scroll-inner" />
          </div>

          <div
            ref={wrapperRef}
            className="evolucao-wrapper"
            onScroll={() => { topScrollRef.current.scrollLeft = wrapperRef.current.scrollLeft; }}
          >
            <table className="evolucao-table">
              <thead>
                <tr className="tr-mes">
                  <th rowSpan={2} className="col-sticky col-codigo">Cód.</th>
                  <th rowSpan={2} className="col-sticky col-grade">Grade</th>
                  <th rowSpan={2} className="col-sticky col-titulo">Título</th>
                  {meses.map(mes => (
                    <th key={mes} colSpan={2} className="col-mes-header">
                      {formatMes(mes)}
                    </th>
                  ))}
                </tr>
                <tr className="tr-sub">
                  {meses.map(mes => (
                    <Fragment key={mes}>
                      <th className="col-sub col-qty">Qtd</th>
                      <th className="col-sub col-val">Valor</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={3 + meses.length * 2} className="vazio">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((item, i) => (
                    <tr key={i}>
                      <td className="col-sticky col-codigo">{item.codigo_item ?? '—'}</td>
                      <td className="col-sticky col-grade">{item.grade || '—'}</td>
                      <td className="col-sticky col-titulo">{item.titulo}</td>
                      {meses.map(mes => {
                        const d = item.meses[mes] ?? { quantidade: 0, valor_total: 0 };
                        const zero = d.quantidade === 0;
                        return (
                          <Fragment key={mes}>
                            <td className={`col-qty${zero ? ' cell-zero' : ''}`}>{d.quantidade}</td>
                            <td className={`col-val${zero ? ' cell-zero' : ''}`}>
                              {zero ? '—' : formatValor(d.valor_total)}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
