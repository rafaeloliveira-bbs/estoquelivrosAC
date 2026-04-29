import { useQuery } from '@tanstack/react-query';
import { relatoriosAPI } from '../api/endpoints';
import './Dashboard.css';

export default function Dashboard() {
  const { data: estoque, isLoading: loadingEstoque, error: erroEstoque } = useQuery({
    queryKey: ['relatorio-estoque'],
    queryFn: () => relatoriosAPI.estoqueAtual().then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: alertas, isLoading: loadingAlertas } = useQuery({
    queryKey: ['relatorio-alertas'],
    queryFn: () => relatoriosAPI.alertasMinimo().then((r) => r.data),
    staleTime: 60_000,
  });

  const loading = loadingEstoque || loadingAlertas;

  if (loading) return <div className="loading">Carregando...</div>;
  if (erroEstoque) return <div className="error">Erro ao carregar dados</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="cards-container">
        {estoque && (
          <div className="card">
            <h3>Estoque Total</h3>
            <p className="value">{estoque.total_itens}</p>
            <p className="label">Itens Únicos</p>
          </div>
        )}

        {alertas && (
          <div className="card alert">
            <h3>Alertas de Mínimo</h3>
            <p className="value">{alertas.total_alertas}</p>
            <p className="label">Itens em Alerta</p>
          </div>
        )}
      </div>

      <div className="section">
        <h2>Itens em Estoque</h2>
        {estoque?.itens?.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Autor</th>
                <th>ISBN</th>
                <th>Quantidade</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {estoque.itens.slice(0, 10).map((item) => (
                <tr key={item.livro_id}>
                  <td>{item.titulo}</td>
                  <td>{item.autor}</td>
                  <td>{item.isbn}</td>
                  <td>{item.quantidade_total}</td>
                  <td>R$ {item.valor_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Nenhum item em estoque</p>
        )}
      </div>

      {alertas?.alertas?.length > 0 && (
        <div className="section">
          <h2>Alertas Ativos</h2>
          <div className="alerts-list">
            {alertas.alertas.map((alerta) => (
              <div key={alerta.livro_id} className="alert-item">
                <strong>{alerta.titulo}</strong>
                <p>
                  Estoque: {alerta.estoque_atual} | Mínimo: {alerta.minimo_configurado}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
