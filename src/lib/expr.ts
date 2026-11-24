/**
 * Avaliador seguro de expressões aritméticas para a memória de cálculo.
 * Aceita números (vírgula ou ponto decimal), + - * / ( ) e "x"/"×" como multiplicação.
 */
export function avaliar(expr: string): number {
  const s = expr.replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').replace(/(\d),(\d)/g, '$1.$2');
  let i = 0;

  const peek = () => s[i];
  function numero(): number {
    const ini = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (ini === i) throw new Error(`Caractere inesperado "${s[i] ?? 'fim'}"`);
    const n = Number(s.slice(ini, i));
    if (!Number.isFinite(n)) throw new Error('Número inválido');
    return n;
  }
  function fator(): number {
    const c = peek();
    if (c === '-') { i++; return -fator(); }
    if (c === '+') { i++; return fator(); }
    if (c === '(') {
      i++;
      const v = soma();
      if (peek() !== ')') throw new Error('Falta ")"');
      i++;
      return v;
    }
    return numero();
  }
  function produto(): number {
    let v = fator();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const d = fator();
      v = op === '*' ? v * d : v / d;
    }
    return v;
  }
  function soma(): number {
    let v = produto();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const d = produto();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  }
  if (!s) return 0;
  const r = soma();
  if (i < s.length) throw new Error(`Caractere inesperado "${s[i]}"`);
  if (!Number.isFinite(r)) throw new Error('Resultado inválido');
  return r;
}

export function tentarAvaliar(expr: string): { valor: number; erro?: string } {
  try {
    return { valor: avaliar(expr) };
  } catch (e) {
    return { valor: 0, erro: (e as Error).message };
  }
}
