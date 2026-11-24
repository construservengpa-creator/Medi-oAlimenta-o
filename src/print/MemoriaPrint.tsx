import { useParams } from 'react-router-dom';
import { useMedicaoPrint, usePagina } from './dados';
import { Assinaturas, BarraImpressao, Cabecalho } from './Cabecalho';
import { calcularBoletim, resultadoLinha } from '../lib/calc';
import { num } from '../lib/format';

export default function MemoriaPrint() {
  const { mid } = useParams();
  const d = useMedicaoPrint(mid);
  usePagina('portrait', d ? `Memória de cálculo ${d.medicao.numero} - Contrato ${d.contrato.numero}` : 'Memória');
  if (!d) return null;
  const b = calcularBoletim(d.contrato, d.itens, d.aditivos, d.medicoes, d.memoria, d.medicao);
  const linhas = d.memoria.filter((l) => l.medicaoId === d.medicao.id);
  const medidos = b.linhas.filter((l) => l.qtdPeriodo !== 0);
  const v = (x?: number | null) => (x === null || x === undefined ? '' : num(x, 3));

  return (
    <>
      <BarraImpressao />
      <div className="folha retrato">
        <Cabecalho titulo={`MEMÓRIA DE CÁLCULO — MEDIÇÃO Nº ${String(d.medicao.numero).padStart(2, '0')}`} contrato={d.contrato} aditivos={d.aditivos} medicao={d.medicao} />
        {medidos.length === 0 && <p>Nenhum serviço medido no período.</p>}
        {medidos.map((l) => {
          const ls = linhas.filter((x) => x.itemId === l.item.id).sort((a, b) => a.ordem - b.ordem);
          return (
            <div key={l.item.id} style={{ marginBottom: 10, pageBreakInside: 'avoid' }}>
              <h2>{l.item.codigo} — {l.item.descricao} ({l.item.unidade})</h2>
              <table>
                <thead><tr><th style={{ textAlign: 'left' }}>Descrição / local</th><th>Qtd</th><th>Comp.</th><th>Larg.</th><th>Alt.</th><th>Fórmula</th><th>Resultado</th></tr></thead>
                <tbody>
                  {ls.length === 0 ? (
                    <tr><td colSpan={6}>Quantidade apurada em campo (sem detalhamento)</td><td className="num">{num(l.qtdPeriodo, 3)}</td></tr>
                  ) : ls.map((x) => (
                    <tr key={x.id}>
                      <td>{x.descricao}</td>
                      <td className="num">{x.formula ? '' : v(x.n)}</td><td className="num">{x.formula ? '' : v(x.c)}</td>
                      <td className="num">{x.formula ? '' : v(x.l)}</td><td className="num">{x.formula ? '' : v(x.h)}</td>
                      <td>{x.formula}</td><td className="num">{num(resultadoLinha(x).valor, 3)}</td>
                    </tr>
                  ))}
                  <tr className="total"><td colSpan={6}>Total no período · acumulado {num(l.qtdAcumulada, 3)} de {num(l.qtdContratada, 3)} contratados ({num(l.percAcumulado, 1)}%)</td><td className="num">{num(l.qtdPeriodo, 3)}</td></tr>
                </tbody>
              </table>
            </div>
          );
        })}
        <Assinaturas contrato={d.contrato} />
      </div>
    </>
  );
}
