import { Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { useContrato } from '../lib/hooks';
import { usePagina } from './dados';
import { Assinaturas, BarraImpressao, Cabecalho } from './Cabecalho';
import { agruparPorEtapa, deltasAditivos, quantidadeAtual, valorAtual } from '../lib/calc';
import { num, rotuloMes } from '../lib/format';

/** Cronograma físico-financeiro consolidado por etapa. */
export default function CronogramaPrint() {
  const { id } = useParams();
  const d = useContrato(id);
  usePagina('landscape', d ? `Cronograma - Contrato ${d.contrato.numero}` : 'Cronograma');
  if (!d) return null;
  const n = d.contrato.mesesCronograma;
  const deltas = deltasAditivos(d.aditivos);
  const total = valorAtual(d.itens, deltas);
  const cron = new Map(d.cronograma.map((c) => [c.itemId, c.percentuais]));
  const meses = Array.from({ length: n }, (_, k) => k);
  const mensal = meses.map(() => 0);

  const grupos = agruparPorEtapa(d.itens).map((g) => {
    const valor = g.itens.reduce((s, i) => s + quantidadeAtual(i, deltas) * i.precoUnitario, 0);
    const mes = meses.map((k) => g.itens.reduce((s, i) => s + (quantidadeAtual(i, deltas) * i.precoUnitario * (cron.get(i.id)?.[k] ?? 0)) / 100, 0));
    mes.forEach((v, k) => (mensal[k] += v));
    return { nome: g.etapa ? `${g.etapa.codigo} ${g.etapa.descricao}` : 'Itens sem etapa', valor, mes };
  });
  let acum = 0;

  return (
    <>
      <BarraImpressao />
      <div className="folha">
        <Cabecalho titulo="CRONOGRAMA FÍSICO-FINANCEIRO" contrato={d.contrato} aditivos={d.aditivos} />
        <table>
          <thead>
            <tr><th>Etapa</th><th>Valor (R$)</th><th>%</th>{meses.map((k) => <th key={k}>Mês {k + 1}<br />{rotuloMes(d.contrato.dataInicio, k)}</th>)}</tr>
          </thead>
          <tbody>
            {grupos.map((g, i) => (
              <Fragment key={i}>
                <tr>
                  <td rowSpan={2}>{g.nome}</td><td rowSpan={2} className="num">{num(g.valor)}</td><td rowSpan={2} className="num">{num(total ? (g.valor / total) * 100 : 0, 2)}</td>
                  {g.mes.map((v, k) => <td key={k} className="num">{v ? `${num(g.valor ? (v / g.valor) * 100 : 0, 1)}%` : ''}</td>)}
                </tr>
                <tr>{g.mes.map((v, k) => <td key={k} className="num" style={{ color: '#555' }}>{v ? num(v) : ''}</td>)}</tr>
              </Fragment>
            ))}
            <tr className="total"><td>Total no mês (R$)</td><td className="num">{num(total)}</td><td className="num">100</td>{mensal.map((v, k) => <td key={k} className="num">{num(v)}</td>)}</tr>
            <tr className="total"><td colSpan={3}>% no mês</td>{mensal.map((v, k) => <td key={k} className="num">{num(total ? (v / total) * 100 : 0)}</td>)}</tr>
            <tr className="total"><td colSpan={3}>Acumulado (R$)</td>{mensal.map((v, k) => <td key={k} className="num">{num((acum += v))}</td>)}</tr>
            <tr className="total"><td colSpan={3}>% acumulado</td>{mensal.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], []).map((v, k) => <td key={k} className="num">{num(total ? (v / total) * 100 : 0)}</td>)}</tr>
          </tbody>
        </table>
        <Assinaturas contrato={d.contrato} />
      </div>
    </>
  );
}
