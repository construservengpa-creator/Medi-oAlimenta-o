import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDados } from './ContratoLayout';
import { previsaoFinanceira } from '../lib/calc';
import { brl, hojeISO, indiceMes, num, rotuloMes } from '../lib/format';
import CurvaS from '../components/CurvaS';
import { baixarCSV } from '../lib/csv';

export default function Previsao() {
  const { contrato, itens, aditivos, cronograma, medicoes, memoria } = useDados();
  const hoje = hojeISO();
  const { meses, total, semCronograma } = previsaoFinanceira(contrato, itens, aditivos, cronograma, medicoes, memoria, hoje);
  const mesHoje = indiceMes(contrato.dataInicio, hoje);
  const rot = (k: number) => rotuloMes(contrato.dataInicio, k);
  const proximos = meses.filter((m) => m.medido === null).slice(0, 3);

  const barras = meses.map((m) => ({ mes: rot(m.indice), Previsto: m.previsto, Medido: m.medido ?? undefined, Reprogramado: m.medido === null ? m.reprogramado : undefined }));

  function exportar() {
    baixarCSV(`previsao-financeira-${contrato.numero}.csv`, [
      ['Mês', 'Referência', 'Previsto', 'Previsto acumulado', '% previsto acum.', 'Medido', 'Medido acumulado', '% medido acum.', 'Reprogramado', 'Reprogramado acum.'],
      ...meses.map((m) => [m.indice + 1, rot(m.indice), m.previsto, m.previstoAcum, +m.percPrevistoAcum.toFixed(2), m.medido ?? '', m.medidoAcum ?? '', m.percMedidoAcum === null ? '' : +m.percMedidoAcum.toFixed(2), m.reprogramado, m.reprogramadoAcum]),
    ]);
  }

  return (
    <>
      {semCronograma > 0.01 && <div className="aviso">{brl(semCronograma)} do contrato ainda não foram distribuídos no cronograma — a previsão está incompleta.</div>}
      <div className="grid g3">
        {proximos.map((m) => (
          <div className="kpi" key={m.indice}>
            <div className="rot">Desembolso previsto · {rot(m.indice)}</div>
            <div className="val">{brl(m.reprogramado)}</div>
            <div className="sub">Cronograma original: {brl(m.previsto)}</div>
          </div>
        ))}
      </div>
      <div className="grid g2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Curva S (% acumulado)</h3>
          <CurvaS contrato={contrato} meses={meses} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Desembolso mensal (R$)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barras} margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#e5eaf0" vertical={false} />
              <XAxis dataKey="mes" fontSize={11} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v) => `${num(v / 1000, 0)}k`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Previsto" fill="#1f5f99" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Medido" fill="#c2650a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Reprogramado" fill="#8a9bb0" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="linha" style={{ margin: '.5rem 0' }}>
        <h3 style={{ margin: 0 }}>Tabela de previsão financeira</h3>
        <span className="espaco" />
        <button onClick={exportar}>Exportar CSV</button>
      </div>
      <div className="tabela-wrap">
        <table className="t">
          <thead>
            <tr><th>Mês</th><th className="num">Previsto</th><th className="num">Previsto acum.</th><th className="num">% prev.</th>
              <th className="num">Medido</th><th className="num">Medido acum.</th><th className="num">% med.</th><th className="num">Desvio acum.</th>
              <th className="num">Previsão reprogramada</th><th className="num">Reprog. acum.</th></tr>
          </thead>
          <tbody>
            {meses.map((m) => {
              const desvio = m.medidoAcum === null ? null : m.medidoAcum - m.previstoAcum;
              return (
                <tr key={m.indice} className={m.indice === mesHoje ? 'sel' : ''}>
                  <td className="nowrap">{m.indice + 1} · {rot(m.indice)}{m.indice === mesHoje && <span className="tag pri" style={{ marginLeft: 6 }}>atual</span>}</td>
                  <td className="num">{num(m.previsto)}</td><td className="num">{num(m.previstoAcum)}</td><td className="num">{num(m.percPrevistoAcum)}%</td>
                  <td className="num">{m.medido === null ? '—' : num(m.medido)}</td>
                  <td className="num">{m.medidoAcum === null ? '—' : num(m.medidoAcum)}</td>
                  <td className="num">{m.percMedidoAcum === null ? '—' : `${num(m.percMedidoAcum)}%`}</td>
                  <td className={`num ${desvio !== null && desvio < 0 ? 'vermelho' : 'verde'}`}>{desvio === null ? '—' : num(desvio)}</td>
                  <td className="num">{num(m.reprogramado)}</td><td className="num">{num(m.reprogramadoAcum)}</td>
                </tr>
              );
            })}
            <tr className="total"><td>Total</td><td className="num">{num(meses.reduce((s, m) => s + m.previsto, 0))}</td><td colSpan={8} className="muted">Valor atual do contrato: {brl(total)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="muted pequeno">A <b>previsão reprogramada</b> mantém o realizado dos meses já medidos e redistribui o saldo a medir nos meses seguintes, na mesma proporção do cronograma original. Use-a para planejar o fluxo de caixa / empenho.</p>
    </>
  );
}
