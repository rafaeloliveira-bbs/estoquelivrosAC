import { useState, useEffect } from 'react';
import { relatoriosAPI } from '../api/endpoints';
import './Dashboard.css';

export default function Dashboard() {
  const [estoque, setEstoque] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [estoqueRes, alertasRes] = await Promise.all([
        relatoriosAPI.estoqueAtual(),
        relatoriosAPI.alertasMinimo(),
      ]);

      setEstoque(estoqueRes.data);
      setAlertas(alertasRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Carregando...</div>;
  if (error) return <div className="error">{error}</div>;

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
