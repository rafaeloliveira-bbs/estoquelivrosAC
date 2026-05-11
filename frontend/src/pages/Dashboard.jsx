import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { relatoriosAPI } from '../api/endpoints';
import './Dashboard.css';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtN = (v) => new Intl.NumberFormat('pt-BR').format(v ?? 0);

function KpiCard({ label, value, variant }) {
  return (
    <div className={`kpi-card kpi-${variant ?? 'default'}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function ComparisonTable({ filiais }) {
  return (
    <div className="section comparison-section">
      <h2>Visao Comparativa entre Filiais</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Filial</th>
            <th>Valor em Estoque</th>
            <th>Titulos Ativos</th>
            <th>Unidades</th>
            <th>Sem Estoque</th>
          </tr>
        </thead>
        <tbody>
          {filiais.map((f) => (
            <tr key={f.filial_id}>
              <td>
                <strong>{f.filial_nome}</strong>
              </td>
              <td className="text-money">{fmt(f.valor_total_estoque)}</td>
              <td>{fmtN(f.total_titulos_ativos)}</td>
              <td>{fmtN(f.total_unidades)}</td>
              <td className={f.titulos_sem_estoque > 0 ? 'text-danger' : ''}>
                {fmtN(f.titulos_sem_estoque)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [filialAtiva, setFilialAtiva] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-filiais'],
    queryFn: () => relatoriosAPI.dashboardFiliais().then((r) => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="dash-loading">Carregando dashboard...</div>;
  if (error) return <div className="dash-error">Erro ao carregar dados</div>;

  const filiais = data?.filiais ?? [];
  const filialEfetiva = filialAtiva ?? filiais[0]?.filial_id;
  const filial = filiais.find((f) => f.filial_id === filialEfetiva);

  if (!filial) return <div className="dash-empty">Nenhuma filial disponivel</div>;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h1>Dashboard</h1>
        <p className="dash-subtitle">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {filiais.length > 1 && (
        <div className="filial-tabs">
          {filiais.map((f) => (
            <button
              key={f.filial_id}
              className={`filial-tab ${f.filial_id === filialEfetiva ? 'active' : ''}`}
              onClick={() => setFilialAtiva(f.filial_id)}
            >
              {f.filial_nome}
            </button>
          ))}
        </div>
      )}

      {filiais.length > 1 && <ComparisonTable filiais={filiais} />}

      <div className="filial-section">
        {filiais.length === 1 && <h2 className="filial-title">{filial.filial_nome}</h2>}

        <div className="kpi-grid">
          <KpiCard
            label="Valor Total em Estoque"
            value={fmt(filial.valor_total_estoque)}
            variant="primary"
          />
          <KpiCard
            label="Titulos Ativos"
            value={fmtN(filial.total_titulos_ativos)}
          />
          <KpiCard
            label="Unidades em Estoque"
            value={fmtN(filial.total_unidades)}
          />
          <KpiCard
            label="Titulos Sem Estoque"
            value={fmtN(filial.titulos_sem_estoque)}
            variant={filial.titulos_sem_estoque > 0 ? 'danger' : 'default'}
          />
        </div>

        <div className="two-col">
          <div className="section">
            <h2>Top Livros por Valor em Estoque</h2>
            {filial.top_por_valor.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Titulo</th>
                    <th>Qtd</th>
                    <th>Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filial.top_por_valor.map((item, i) => (
                    <tr key={item.livro_id}>
                      <td>
                        <span className="rank-badge">{i + 1}</span>
                      </td>
                      <td>
                        <div className="book-title">{item.titulo}</div>
                        {item.isbn && <div className="book-isbn">{item.isbn}</div>}
                      </td>
                      <td>{fmtN(item.quantidade_total)}</td>
                      <td className="text-money">{fmt(item.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">Nenhum livro com estoque valorado</div>
            )}
          </div>

          <div className="section">
            <h2>
              Livros Sem Estoque
              {filial.titulos_sem_estoque > 0 && (
                <span className="badge-count">{fmtN(filial.titulos_sem_estoque)}</span>
              )}
            </h2>
            {filial.sem_estoque.length > 0 ? (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Titulo</th>
                      <th>ISBN</th>
                      <th>Min.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filial.sem_estoque.map((item) => (
                      <tr key={item.livro_id} className="row-sem-estoque">
                        <td>{item.titulo}</td>
                        <td className="book-isbn">{item.isbn || '—'}</td>
                        <td>{item.estoque_minimo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filial.titulos_sem_estoque > filial.sem_estoque.length && (
                  <p className="more-hint">
                    + {fmtN(filial.titulos_sem_estoque - filial.sem_estoque.length)} outros titulos
                    sem estoque
                  </p>
                )}
              </>
            ) : (
              <div className="empty-state success">Todos os titulos possuem estoque</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
