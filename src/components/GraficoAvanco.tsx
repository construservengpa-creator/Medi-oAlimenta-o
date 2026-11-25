import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DadosContrato } from '../lib/hooks';
import { agruparPorEtapa, deltasAditivos, previsaoFinanceira, quantidadeAtual, quantidadesMedicao } from '../lib/calc';
import { brl, hojeISO, indiceMes, num, rotuloMes } from '../lib/format';
import CurvaS from './CurvaS';

export const COR_PREVISTO = '#1f5f99';
export const COR_REALIZADO = '#c2650a';
export const COR_REPROGRAMADO = '#8a9bb0';

type Tipo = 'gantt' | 'etapas' | 'curva' | 'mensal';
type Nivel = 'etapa' | 'item';

interface Linha {
  id: string;
  codigo: string;
  nome: string;
  etapa: boolean;
  valor: number;
  mensal: number[]; // previsto R$ por mês
  realizado: number; // R$ acumulado medido
  percPrevisto: number; // % previsto até hoje
  percRealizado: number;
}

/** Monta as linhas (por etapa ou item) com previsto até hoje e realizado acumulado. */
function montarLinhas(d: DadosContrato, nivel: Nivel, n: number, hoje: string): Linha[] {
  const deltas = deltasAditivos(d.aditivos);
  const cron = new Map(d.cronograma.map((c) => [c.itemId, c.percentuais]));
  const qtd = new Map<string, number>();
  for (const m of d.medicoes) for (const [k, v] of quantidadesMedicao(m, d.memoria)) qtd.set(k, (qtd.get(k) ?? 0) + v);

  const k = indiceMes(d.contrato.dataInicio, hoje);
  const fracMes = Math.min(Number(hoje.slice(8, 10)), 30) / 30;
  const previstoAte = (mensal: number[]) => {
    if (k < 0) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i < k) s += mensal[i];
      else if (i === k) s += mensal[i] * fracMes;
    }
    return s;
  };

  const porItem = (i: DadosContrato['itens'][number]) => {
    const valor = quantidadeAtual(i, deltas) * i.precoUnitario;
    const p = cron.get(i.id) ?? [];
    const mensal = Array.from({ length: n }, (_, j) => (valor * (p[j] ?? 0)) / 100);
    return { valor, mensal, realizado: (qtd.get(i.id) ?? 0) * i.precoUnitario };
  };

  const linhas: Linha[] = [];
  for (const g of agruparPorEtapa(d.itens)) {
    const itens = g.itens.map((i) => ({ i, ...porItem(i) }));
    if (nivel === 'etapa') {
      const valor = itens.reduce((s, x) => s + x.valor, 0);
      if (!valor) continue;
      const mensal = Array.from({ length: n }, (_, j) => itens.reduce((s, x) => s + x.mensal[j], 0));
      const realizado = itens.reduce((s, x) => s + x.realizado, 0);
      linhas.push({
        id: g.etapa?.id ?? 'sem-etapa', codigo: g.etapa?.codigo ?? '', nome: g.etapa?.descricao || 'Itens sem etapa', etapa: true,
        valor, mensal, realizado, percPrevisto: (previstoAte(mensal) / valor) * 100, percRealizado: (realizado / valor) * 100,
      });
    } else {
      for (const x of itens) {
        if (!x.valor) continue;
        linhas.push({
          id: x.i.id, codigo: x.i.codigo, nome: x.i.descricao, etapa: false, valor: x.valor, mensal: x.mensal, realizado: x.realizado,
          percPrevisto: (previstoAte(x.mensal) / x.valor) * 100, percRealizado: (x.realizado / x.valor) * 100,
        });
      }
    }
  }
  return linhas;
}

export default function GraficoAvanco({ d }: { d: DadosContrato }) {
  const [tipo, setTipo] = useState<Tipo>('gantt');
  const [nivel, setNivel] = useState<Nivel>('etapa');
  const hoje = hojeISO();
  const n = d.contrato.mesesCronograma;
  const linhas = montarLinhas(d, nivel, n, hoje);

  return (
    <div className="card">
      <div className="linha" style={{ marginBottom: '.75rem' }}>
        <h3 style={{ margin: 0 }}>Gráfico de avanço</h3>
        <span className="espaco" />
        <div className="segmentado" role="tablist" aria-label="Tipo de gráfico">
          {([['gantt', 'Gantt'], ['etapas', 'Avanço físico'], ['curva', 'Curva S'], ['mensal', 'Desembolso mensal']] as [Tipo, string][]).map(([t, r]) => (
            <button key={t} type="button" role="tab" aria-selected={tipo === t} className={tipo === t ? 'ativo' : ''} onClick={() => setTipo(t)}>{r}</button>
          ))}
        </div>
        {(tipo === 'gantt' || tipo === 'etapas') && (
          <div className="segmentado" aria-label="Detalhamento">
            {([['etapa', 'Por etapa'], ['item', 'Por item']] as [Nivel, string][]).map(([v, r]) => (
              <button key={v} type="button" aria-pressed={nivel === v} className={nivel === v ? 'ativo' : ''} onClick={() => setNivel(v)}>{r}</button>
            ))}
          </div>
        )}
      </div>

      {linhas.length === 0 && tipo !== 'curva' && tipo !== 'mensal'
        ? <p className="muted">Cadastre a planilha e distribua o cronograma para ver o gráfico.</p>
        : tipo === 'gantt' ? <Gantt d={d} linhas={linhas} n={n} hoje={hoje} />
        : tipo === 'etapas' ? <AvancoFisico linhas={linhas} />
        : tipo === 'curva' ? <CurvaComDados d={d} hoje={hoje} />
        : <Desembolso d={d} hoje={hoje} />}
    </div>
  );
}

/* ---------------- Gantt ---------------- */

function Gantt({ d, linhas, n, hoje }: { d: DadosContrato; linhas: Linha[]; n: number; hoje: string }) {
  const [hover, setHover] = useState<{ l: Linha; x: number; y: number } | null>(null);
  const k = indiceMes(d.contrato.dataInicio, hoje);
  const posHoje = k < 0 || k >= n ? null : ((k + Math.min(Number(hoje.slice(8, 10)), 30) / 30) / n) * 100;

  return (
    <div className="gantt" onMouseLeave={() => setHover(null)}>
      <div className="gantt-linha gantt-cab">
        <div className="gantt-nome">{linhas[0]?.etapa ? 'Etapa' : 'Item'}</div>
        <div className="gantt-trilho">
          {Array.from({ length: n }, (_, i) => <div key={i} className="gantt-mes">{rotuloMes(d.contrato.dataInicio, i)}</div>)}
        </div>
        <div className="gantt-pct">Real. / Prev.</div>
      </div>
      {linhas.map((l) => {
        const ativos = l.mensal.map((v, i) => (v > 0.005 ? i : -1)).filter((i) => i >= 0);
        const ini = ativos.length ? ativos[0] : 0;
        const fim = ativos.length ? ativos[ativos.length - 1] + 1 : 0;
        const atraso = l.percPrevisto - l.percRealizado > 5;
        return (
          <div key={l.id} className={`gantt-linha ${l.etapa ? 'gantt-etapa' : ''}`}
            onMouseMove={(e) => setHover({ l, x: e.clientX, y: e.clientY })}>
            <div className="gantt-nome" title={l.nome}><b>{l.codigo}</b> {l.nome}</div>
            <div className="gantt-trilho">
              {Array.from({ length: n }, (_, i) => <div key={i} className="gantt-grade" />)}
              {ativos.length > 0 && (
                <div className="gantt-barra" style={{ left: `${(ini / n) * 100}%`, width: `${((fim - ini) / n) * 100}%` }}>
                  <div className="gantt-real" style={{ width: `${Math.min(100, l.percRealizado)}%` }} />
                </div>
              )}
              {posHoje !== null && <div className="gantt-hoje" style={{ left: `${posHoje}%` }} />}
            </div>
            <div className="gantt-pct">
              {num(l.percRealizado, 0)}% / {num(l.percPrevisto, 0)}%
              {atraso && <span className="tag alerta" style={{ marginLeft: 4 }} title="Realizado mais de 5 pontos abaixo do previsto">⚠ atraso</span>}
            </div>
          </div>
        );
      })}
      <div className="gantt-legenda">
        <span><i style={{ background: '#c9d9ea' }} /> Período previsto no cronograma</span>
        <span><i style={{ background: COR_REALIZADO }} /> Realizado (medido acumulado)</span>
        <span><i className="linha-hoje" /> Hoje</span>
      </div>
      {hover && (
        <div className="dica" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <b>{hover.l.codigo} {hover.l.nome}</b>
          <div>Valor: {brl(hover.l.valor)}</div>
          <div>Previsto até hoje: {num(hover.l.percPrevisto, 1)}%</div>
          <div>Realizado: {num(hover.l.percRealizado, 1)}% ({brl(hover.l.realizado)})</div>
          <div className="muted">Meses: {hover.l.mensal.map((v, i) => (v > 0.005 ? rotuloMes(d.contrato.dataInicio, i) : null)).filter(Boolean).join(', ') || '—'}</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Avanço físico (previsto x realizado) ---------------- */

function AvancoFisico({ linhas }: { linhas: Linha[] }) {
  const dados = linhas.map((l) => ({
    nome: `${l.codigo} ${l.nome}`.trim().slice(0, 38),
    Previsto: +l.percPrevisto.toFixed(1),
    Realizado: +l.percRealizado.toFixed(1),
  }));
  const altura = Math.max(220, dados.length * 44 + 60);
  return (
    <>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke="#e5eaf0" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="nome" width={230} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => `${num(v, 1)}%`} cursor={{ fill: 'rgba(31,95,153,.06)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Previsto" name="Previsto até hoje" fill={COR_PREVISTO} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number) => `${num(v, 0)}%` }} />
          <Bar dataKey="Realizado" name="Realizado" fill={COR_REALIZADO} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#1d2733', formatter: (v: number) => `${num(v, 0)}%` }} />
        </BarChart>
      </ResponsiveContainer>
      <p className="muted pequeno" style={{ margin: 0 }}>Percentual físico de cada {linhas[0]?.etapa ? 'etapa' : 'item'}: previsto pelo cronograma até hoje × medido acumulado (inclui medições em análise).</p>
    </>
  );
}

/* ---------------- Curva S e desembolso ---------------- */

function CurvaComDados({ d, hoje }: { d: DadosContrato; hoje: string }) {
  const { meses } = previsaoFinanceira(d.contrato, d.itens, d.aditivos, d.cronograma, d.medicoes, d.memoria, hoje);
  return <CurvaS contrato={d.contrato} meses={meses} altura={320} />;
}

function Desembolso({ d, hoje }: { d: DadosContrato; hoje: string }) {
  const { meses } = previsaoFinanceira(d.contrato, d.itens, d.aditivos, d.cronograma, d.medicoes, d.memoria, hoje);
  const dados = meses.map((m) => ({
    mes: rotuloMes(d.contrato.dataInicio, m.indice),
    Previsto: m.previsto,
    Medido: m.medido ?? undefined,
    Reprogramado: m.medido === null ? m.reprogramado : undefined,
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 10, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="#e5eaf0" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} tickLine={false} />
        <YAxis fontSize={11} tickFormatter={(v) => `${num(v / 1000, 0)}k`} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number) => brl(v)} cursor={{ fill: 'rgba(31,95,153,.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Previsto" fill={COR_PREVISTO} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Medido" fill={COR_REALIZADO} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Reprogramado" fill={COR_REPROGRAMADO} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
