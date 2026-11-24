/** Gera CSV compatível com Excel em português (separador ";" e BOM UTF-8). */
export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 6, useGrouping: false }) : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const txt = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
  baixarArquivo(nome, new Blob([txt], { type: 'text/csv;charset=utf-8' }));
}

export function baixarArquivo(nome: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Lê texto colado do Excel (tabulação) ou CSV (; ou ,). */
export function lerTabela(txt: string): string[][] {
  const linhas = txt.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = linhas[0].includes('\t') ? '\t' : linhas[0].includes(';') ? ';' : ',';
  return linhas.map((l) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (q && l[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === sep && !q) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}
