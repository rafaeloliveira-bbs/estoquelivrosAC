import apiClient from './client';

export const authAPI = {
  login: (email, senha) => apiClient.post('/auth/login', { email, senha }),
  refresh: (token) => apiClient.post('/auth/refresh', { token }),
};

export const livrosAPI = {
  listar: (skip = 0, limit = 100) => apiClient.get('/livros/', { params: { skip, limit } }),
  listarComEstoque: (termo = null, filial_id = null, skip = 0, limit = 2000) =>
    apiClient.get('/livros/com-estoque', { params: { termo, filial_id, skip, limit } }),
  obter: (id) => apiClient.get(`/livros/${id}`),
  porCodigo: (codigo_item) => apiClient.get(`/livros/por-codigo/${codigo_item}`),
  criar: (livro) => apiClient.post('/livros/', livro),
  atualizar: (id, livro) => apiClient.put(`/livros/${id}`, livro),
  deletar: (id) => apiClient.delete(`/livros/${id}`),
  buscar: (termo, skip = 0, limit = 100) => apiClient.get('/livros/buscar', { params: { termo, skip, limit } }),
  importarCSV: (formData) => apiClient.post('/livros/importar-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  previewCSV: (formData) => apiClient.post('/livros/preview-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  baixarTemplateCSV: () => apiClient.get('/livros/template-csv', { responseType: 'blob' }),
  limparTodos: () => apiClient.delete('/livros/limpar-todos'),
};

export const movimentacoesAPI = {
  registrarVenda: (livro_id, quantidade, preco_unitario, data_movimento, motivo, documento, observacoes) =>
    apiClient.post('/movimentacoes/venda', null, {
      params: { livro_id, quantidade, preco_unitario, data_movimento, motivo, documento_referencia: documento, observacoes },
    }),
  registrarCompra: (livro_id, quantidade, preco_unitario, numero_lote, fornecedor, observacoes, data_entrada) =>
    apiClient.post('/movimentacoes/compra', null, {
      params: { livro_id, quantidade, preco_unitario, numero_lote, fornecedor, observacoes, data_entrada },
    }),
  obterEstoque: (livro_id) => apiClient.get(`/movimentacoes/estoque/${livro_id}`),
  templateHistoricoEntradas: () =>
    apiClient.get('/movimentacoes/historico-entradas/template-csv', { responseType: 'blob' }),
  previewHistoricoEntradas: (formData) =>
    apiClient.post('/movimentacoes/historico-entradas/preview-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importarHistoricoEntradas: (formData, filial_id) =>
    apiClient.post('/movimentacoes/historico-entradas/importar-csv', formData, {
      params: { filial_id },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  templateHistoricoSaidas: () =>
    apiClient.get('/movimentacoes/historico-saidas/template-csv', { responseType: 'blob' }),
  previewHistoricoSaidas: (formData) =>
    apiClient.post('/movimentacoes/historico-saidas/preview-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importarHistoricoSaidas: (formData, filial_id) =>
    apiClient.post('/movimentacoes/historico-saidas/importar-csv', formData, {
      params: { filial_id },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  limparHistorico: (filial_id, tipo) =>
    apiClient.delete('/movimentacoes/historico', { params: { filial_id, tipo } }),
};

export const relatoriosAPI = {
  estoqueAtual: () => apiClient.get('/relatorios/estoque-atual'),
  alertasMinimo: () => apiClient.get('/relatorios/alertas-minimo'),
  movimentacoes: (data_inicio, data_fim, tipo, filial_id) =>
    apiClient.get('/relatorios/movimentacoes', { params: { data_inicio, data_fim, tipo, filial_id } }),
  topVendas: (limite = 10, mes, ano) =>
    apiClient.get('/relatorios/top-vendas', { params: { limite, mes, ano } }),
  lotesVencimento: (dias = 30) => apiClient.get('/relatorios/lotes-vencimento', { params: { dias_proximos: dias } }),
  evolucaoEstoque: (filial_id) => apiClient.get('/relatorios/evolucao-estoque', { params: { filial_id } }),
};

export const usuariosAPI = {
  listar: (skip = 0, limit = 100) => apiClient.get('/usuarios/', { params: { skip, limit } }),
  obter: (id) => apiClient.get(`/usuarios/${id}`),
  criar: (usuario) => apiClient.post('/usuarios/', usuario),
  atualizar: (id, usuario) => apiClient.put(`/usuarios/${id}`, usuario),
  deletar: (id) => apiClient.delete(`/usuarios/${id}`),
  listarFiliais: (id) => apiClient.get(`/usuarios/${id}/filiais`),
  atualizarFiliais: (id, filial_ids) => apiClient.put(`/usuarios/${id}/filiais`, { filial_ids }),
};

export const categoriasAPI = {
  listar: (skip = 0, limit = 100) => apiClient.get('/categorias/', { params: { skip, limit } }),
  obter: (id) => apiClient.get(`/categorias/${id}`),
  criar: (cat) => apiClient.post('/categorias/', cat),
  atualizar: (id, cat) => apiClient.put(`/categorias/${id}`, cat),
  deletar: (id) => apiClient.delete(`/categorias/${id}`),
};

export const filiaisAPI = {
  listar: (skip = 0, limit = 100) => apiClient.get('/filiais/', { params: { skip, limit } }),
  obter: (id) => apiClient.get(`/filiais/${id}`),
  criar: (filial) => apiClient.post('/filiais/', filial),
  atualizar: (id, filial) => apiClient.put(`/filiais/${id}`, filial),
  deletar: (id) => apiClient.delete(`/filiais/${id}`),
};
