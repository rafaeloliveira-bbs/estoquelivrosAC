/**
 * Converte string de valor monetário para number.
 * Aceita: "R$ 29,90" · "R$29.90" · "29,90" · "1.234,56" · "29.90"
 */
export function parseMoeda(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  let s = String(raw).trim().replace(/[Rr]\$\s*/g, '');
  if (s.includes(',') && s.includes('.')) {
    // formato BR "1.234,56" — ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Formata number para string no padrão BR (sem símbolo): "29,90"
 * Útil para pré-preencher inputs de texto.
 */
export function formatMoedaBR(value) {
  if (value === null || value === undefined || value === '') return '';
  return parseFloat(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
