import { useEffect, useState, type InputHTMLAttributes } from 'react';
import type { StatusContrato as SC, StatusMedicao as SM } from '../lib/db';
import { num, parseNum } from '../lib/format';

export function Barra({ valor, marca, cor }: { valor: number; marca?: number; cor?: string }) {
  return (
    <div className="barra">
      <span style={{ width: `${Math.max(0, Math.min(100, valor))}%`, background: cor }} />
      {marca !== undefined && <i style={{ left: `${Math.max(0, Math.min(100, marca))}%` }} title={`Previsto ${num(marca, 1)}%`} />}
    </div>
  );
}

export function StatusContrato({ s }: { s: SC }) {
  const m = { ativo: ['ok', 'Ativo'], paralisado: ['alerta', 'Paralisado'], concluido: ['', 'Concluído'] }[s];
  return <span className={`tag ${m[0]}`}>{m[1]}</span>;
}

export function StatusMedicao({ s }: { s: SM }) {
  const m = { rascunho: ['', 'Rascunho'], em_analise: ['alerta', 'Em análise'], aprovada: ['ok', 'Aprovada'] }[s];
  return <span className={`tag ${m[0]}`}>{m[1]}</span>;
}

/**
 * Campo numérico no formato brasileiro. Mantém o texto enquanto digita
 * e só chama onCommit ao sair do campo (ou Enter).
 */
export function NumInput({
  value, onCommit, casas = 2, vazio = false, ...rest
}: { value: number | null | undefined; onCommit: (v: number | null) => void; casas?: number; vazio?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined || (vazio && v === 0) ? '' : num(v, casas));
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => setTxt(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const t = txt.trim();
    const v = t === '' ? null : parseNum(t);
    if (v !== value) onCommit(v);
    setTxt(fmt(v));
  };
  return (
    <input
      {...rest}
      className={`num ${rest.className ?? ''}`}
      inputMode="decimal"
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
