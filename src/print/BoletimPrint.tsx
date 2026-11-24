import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMedicaoPrint, usePagina } from './dados';
import { Assinaturas, BarraImpressao, Cabecalho } from './Cabecalho';
import { agruparPorEtapa, calcularBoletim } from '../lib/calc';
import { brl, num } from '../lib/format';

export default function BoletimPrint() {
  const { mid } = useParams();
  const d = useMedicaoPrint(mid);
  const [soMedidos, setSoMedidos] = useState(false);
  usePagina('landscape', d ? `Boletim ${d.medicao.numero} - Contrato ${d.contrato.numero}` : 'Boletim');
  if (!d) return null;
  const b = calcularBoletim(d.contrato, d.itens, d.aditivos, d.medicoes, d.memoria, d.medicao);
  const porItem = new Map(b.linhas.map((l) => [l.item.id, l]));

  return (
    <>
      <BarraImpressao>
        <label><input type="checkbox" checked={soMedidos} onChange={(e) => setSoMedidos(e.target.checked)} /> somente itens medidos no período</label>
      </BarraImpressao>
      <div className="folha">
        <Cabecalho titulo={`BOLETIM DE MEDIÇÃO Nº ${String(d.medicao.numero).padStart(2, '0')}`} contrato={d.contrato} aditivos={d.aditivos} medicao={d.medicao} />
        {d.medicao.status !== 'aprovada' && <div style={{ textAlign: 'center', color: '#b00', fontWeight: 700, marginBottom: 4 }}>DOCUMENTO PRELIMINAR — MEDIÇÃO {d.medicao.status === 'rascunho' ? 'EM ELABORAÇÃO' : 'EM ANÁLISE'}</div>}
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Item</th><th rowSpan={2}>Descrição</th><th rowSpan={2}>Un.</th>
              <th colSpan={3}>Contratado</th><th colSpan={4}>Quantidades</th><th colSpan={3}>Valores (R$)</th><th rowSpan={2}>%<br />acum.</th>
            </tr>
            <tr>
              <th>Qtd</th><th>P. unit.</th><th>Total</th>
              <th>Anterior</th><th>Período</th><th>Acumulado</th><th>Saldo</th>
              <th>Período</th><th>Acumulado</th><th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {agruparPorEtapa(d.itens).flatMap((g) => {
              const ls = g.itens.map((i) => porItem.get(i.id)!).filter((l) => l && (!soMedidos || l.qtdPeriodo !== 0));
              if (!ls.length) return [];
              const s = (f: (l: (typeof ls)[number]) => number) => ls.reduce((a, l) => a + f(l), 0);
              const rows = [];
              if (g.etapa)
                rows.push(
                  <tr className="etapa" key={g.etapa.id}>
                    <td>{g.etapa.codigo}</td><td colSpan={4}>{g.etapa.descricao}</td><td className="num">{num(s((l) => l.valorContratado))}</td><td colSpan={4} />
                    <td className="num">{num(s((l) => l.valorPeriodo))}</td><td className="num">{num(s((l) => l.valorAcumulado))}</td><td className="num">{num(s((l) => l.valorContratado - l.valorAcumulado))}</td>
                    <td className="num">{num((s((l) => l.valorAcumulado) / (s((l) => l.valorContratado) || 1)) * 100, 1)}</td>
                  </tr>,
                );
              for (const l of ls)
                rows.push(
                  <tr key={l.item.id}>
                    <td>{l.item.codigo}</td><td>{l.item.descricao}</td><td>{l.item.unidade}</td>
                    <td className="num">{num(l.qtdContratada)}</td><td className="num">{num(l.item.precoUnitario)}</td><td className="num">{num(l.valorContratado)}</td>
                    <td className="num">{num(l.qtdAnterior)}</td><td className="num">{l.qtdPeriodo ? num(l.qtdPeriodo) : '-'}</td>
                    <td className={`num ${l.excedido ? 'excedido' : ''}`}>{num(l.qtdAcumulada)}</td><td className="num">{num(l.saldoQtd)}</td>
                    <td className="num">{l.valorPeriodo ? num(l.valorPeriodo) : '-'}</td><td className="num">{num(l.valorAcumulado)}</td>
                    <td className="num">{num(l.valorContratado - l.valorAcumulado)}</td><td className="num">{num(l.percAcumulado, 1)}</td>
                  </tr>,
                );
              return rows;
            })}
            <tr className="total">
              <td colSpan={5}>TOTAL</td><td className="num">{num(b.valorContratado)}</td><td colSpan={4} />
              <td className="num">{num(b.valorPeriodo)}</td><td className="num">{num(b.valorAcumulado)}</td><td className="num">{num(b.saldoContratual)}</td><td className="num">{num(b.percExecutado, 1)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 10, pageBreakInside: 'avoid' }}>
          <table>
            <tbody>
              <tr><th colSpan={2}>RESUMO FINANCEIRO DA MEDIÇÃO</th></tr>
              <tr><td>Valor dos serviços medidos no período</td><td className="num">{brl(b.valorPeriodo)}</td></tr>
              {b.reajuste !== 0 && <tr><td>Reajuste ({num(d.medicao.reajustePercentual, 4)}%)</td><td className="num">{brl(b.reajuste)}</td></tr>}
              <tr><td><b>Valor bruto da medição</b></td><td className="num"><b>{brl(b.valorBruto)}</b></td></tr>
              {b.retencoes.map((r) => <tr key={r.nome}><td>(−) {r.nome} — {num(r.percentual)}% sobre {num(r.base, 0)}%</td><td className="num">{brl(r.valor)}</td></tr>)}
              <tr className="total"><td>VALOR LÍQUIDO A PAGAR</td><td className="num">{brl(b.valorLiquido)}</td></tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr><th colSpan={2}>SITUAÇÃO DO CONTRATO</th></tr>
              <tr><td>Valor contratual atual</td><td className="num">{brl(b.valorContratado)}</td></tr>
              <tr><td>Medido até a medição anterior</td><td className="num">{brl(b.valorAnterior)}</td></tr>
              <tr><td>Medido nesta medição</td><td className="num">{brl(b.valorPeriodo)}</td></tr>
              <tr><td>Medido acumulado</td><td className="num">{brl(b.valorAcumulado)} ({num(b.percExecutado, 2)}%)</td></tr>
              <tr className="total"><td>Saldo contratual</td><td className="num">{brl(b.saldoContratual)}</td></tr>
            </tbody>
          </table>
        </div>
        {d.medicao.observacoes && <p><b>Observações:</b> {d.medicao.observacoes}</p>}
        <Assinaturas contrato={d.contrato} />
      </div>
    </>
  );
}
