const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const brl = (n: number) => brlFmt.format(Number.isFinite(n) ? n : 0);

export function num(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export const pct = (n: number, casas = 2) => `${num(n, casas)}%`;

/** Converte "1.234,56", "1234.56" ou "1234,56" em número. */
export function parseNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return 0;
  let s = String(v).trim().replace(/[R$\s%]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    // o último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diffDias(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Rótulo do mês i do cronograma (i = 0 é o mês de início). */
export function rotuloMes(inicio: string, i: number): string {
  const [y, m] = inicio.split('-').map(Number);
  const t = (m - 1) + i;
  const ano = y + Math.floor(t / 12);
  return `${MESES[((t % 12) + 12) % 12]}/${String(ano).slice(2)}`;
}

/** Índice do mês do cronograma em que cai a data. */
export function indiceMes(inicio: string, data: string): number {
  const [y1, m1] = inicio.split('-').map(Number);
  const [y2, m2] = data.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
