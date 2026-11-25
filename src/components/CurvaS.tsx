import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Contrato } from '../lib/db';
import type { MesPrevisao } from '../lib/calc';
import { num, rotuloMes } from '../lib/format';

export default function CurvaS({ contrato, meses, altura = 300 }: { contrato: Contrato; meses: MesPrevisao[]; altura?: number }) {
  const dados = meses.map((m) => ({
    mes: rotuloMes(contrato.dataInicio, m.indice),
    previsto: +m.percPrevistoAcum.toFixed(2),
    realizado: m.percMedidoAcum === null ? undefined : +m.percMedidoAcum.toFixed(2),
    reprogramado: +m.percReprogramadoAcum.toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5eaf0" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} tickLine={false} />
        <YAxis fontSize={11} unit="%" domain={[0, 100]} tickLine={false} axisLine={false} width={45} />
        <Tooltip formatter={(v: number) => `${num(v, 2)}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="previsto" name="Previsto" stroke="#1f5f99" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="reprogramado" name="Reprogramado" stroke="#8a9bb0" strokeDasharray="5 4" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#c2650a" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
