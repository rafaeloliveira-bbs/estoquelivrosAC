import { useState, useEffect } from 'react';
import { relatoriosAPI } from '../api/endpoints';
import './Relatorios.css';

const ABAS = [
  { id: 'estoque', label: 'Estoque Atual' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'topVendas', label: 'Top Vendas' },
  { id: 'vencimentos', label: 'Lotes p/ Vencer' },
];

export default function Relatorios() {
  const [aba, setAba] = useState('estoque');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [diasVencimento, setDiasVencimento] = useState(30);

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      let res;
      if (aba === 'estoque') {
        res = await relatoriosAPI.estoqueAtual();
      } else if (aba === 'movimentacoes') {
        res = await relatoriosAPI.movimentacoes(dataInicio || undefined, dataFim || undefined);
      } else if (aba === 'topVendas') {
        res = await relatoriosAPI.topVendas(10, mes || undefined, ano || undefined);
      } else if (aba === 'vencimentos') {
        res = await relatoriosAPI.lotesVencimento(diasVencimento);
      }
      setDados(res.data);
    } catch {
      setErro('Erro ao carregar relatório');
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [aba]);

  return (
    <div className="relatorios-page">
      <h1>Relatórios</h1>

      <div className="abas">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`aba ${aba === a.id ? 'ativa' : ''}`}
            onClick={() => { setAba(a.id); setDados(null); }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="relatorio-body">
        {/* Filtros por aba */}
        {aba === 'movimentacoes' && (
          <div className="filtros">
            <div className="filtro-grupo">
              <label>Data início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="filtro-grupo">
              <label>Data fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <button className="btn-filtrar" onClick={carregar}>Filtrar</button>
          </div>
        )}

        {aba === 'topVendas' && (
          <div className="filtros">
            <div className="filtro-grupo">
              <label>Mês</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)}>
                <option value="">Todos</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div className="filtro-grupo">
              <label>Ano</label>
              <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} min="2000" max="2099" />
            </div>
            <button className="btn-filtrar" onClick={carregar}>Filtrar</button>
          </div>
        )}

        {aba === 'vencimentos' && (
          <div className="filtros">
            <div className="filtro-grupo">
              <label>Próximos (dias)</label>
              <input type="number" value={diasVencimento} min="1" max="365" onChange={(e) => setDiasVencimento(e.target.value)} />
            </div>
            <button className="btn-filtrar" onClick={carregar}>Filtrar</button>
          </div>
        )}

        {erro && <div className="alert-error">{erro}</div>}
        {loading && <div className="loading">Carregando...</div>}

        {!loading && dados && (
          <>
            {aba === 'estoque' && <TabelaEstoque dados={dados} />}
            {aba === 'movimentacoes' && <TabelaMovimentacoes dados={dados} />}
            {aba === 'topVendas' && <TabelaTopVendas dados={dados} />}
            {aba === 'vencimentos' && <TabelaVencimentos dados={dados} />}
          </>
        )}
      </div>
    </div>
  );
}

function TabelaEstoque({ dados }) {
  if (!dados.length) return <p className="vazio">Nenhum item em estoque</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Título</th>
          <th>Autor</th>
          <th>Qtd. Disponível</th>
          <th>Valor em Estoque</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((item, i) => (
          <tr key={i}>
            <td>{item.titulo}</td>
            <td>{item.autor}</td>
            <td>{item.quantidade_disponivel}</td>
            <td>R$ {parseFloat(item.valor_total || 0).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaMovimentacoes({ dados }) {
  if (!dados.length) return <p className="vazio">Nenhuma movimentação no período</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Livro</th>
          <th>Qtd.</th>
          <th>Preço Unit.</th>
          <th>Usuário</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((m, i) => (
          <tr key={i}>
            <td>{new Date(m.data_movimento).toLocaleString('pt-BR')}</td>
            <td>
              <span className={`badge ${m.tipo === 'venda' ? 'badge-red' : 'badge-green'}`}>
                {m.tipo}
              </span>
            </td>
            <td>{m.titulo || m.livro_id}</td>
            <td>{m.quantidade}</td>
            <td>{m.preco_unitario ? `R$ ${parseFloat(m.preco_unitario).toFixed(2)}` : '-'}</td>
            <td>{m.usuario_nome || m.usuario_id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaTopVendas({ dados }) {
  if (!dados.length) return <p className="vazio">Nenhuma venda no período</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Posição</th>
          <th>Título</th>
          <th>Autor</th>
          <th>Total Vendido</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((item, i) => (
          <tr key={i}>
            <td>#{i + 1}</td>
            <td>{item.titulo}</td>
            <td>{item.autor}</td>
            <td>{item.total_vendido}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaVencimentos({ dados }) {
  if (!dados.length) return <p className="vazio">Nenhum lote próximo do vencimento</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Livro</th>
          <th>Lote</th>
          <th>Qtd. Disponível</th>
          <th>Validade</th>
          <th>Urgência</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((l, i) => (
          <tr key={i}>
            <td>{l.titulo}</td>
            <td>{l.numero_lote}</td>
            <td>{l.quantidade_disponivel}</td>
            <td>{new Date(l.validade_minima).toLocaleDateString('pt-BR')}</td>
            <td>
              <span className={`badge ${l.urgencia === 'CRITICO' ? 'badge-red' : 'badge-yellow'}`}>
                {l.urgencia}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
