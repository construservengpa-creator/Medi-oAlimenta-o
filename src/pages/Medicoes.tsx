import { Link, useNavigate } from 'react-router-dom';
import { useDados } from './ContratoLayout';
import { db, excluirMedicao, uid } from '../lib/db';
import { calcularBoletim } from '../lib/calc';
import { addDias, brl, fmtDate, hojeISO, num } from '../lib/format';
import { StatusMedicao } from '../components/ui';

function fimDoMes(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Medicoes() {
  const d = useDados();
  const { contrato, medicoes } = d;
  const nav = useNavigate();

  async function nova() {
    const ult = medicoes[medicoes.length - 1];
    if (ult && ult.status === 'rascunho' && !confirm(`A ${ult.numero}ª medição ainda está em rascunho. Criar uma nova mesmo assim?`)) return;
    const inicio = ult ? addDias(ult.periodoFim, 1) : contrato.dataInicio;
    const id = uid();
    await db.medicoes.add({
      id, contratoId: contrato.id, numero: (ult?.numero ?? 0) + 1, periodoInicio: inicio, periodoFim: fimDoMes(inicio),
      dataEmissao: hojeISO(), status: 'rascunho', reajustePercentual: 0, quantidadesManuais: {},
    });
    nav(id);
  }

  return (
    <>
      <div className="linha" style={{ marginBottom: '.75rem' }}>
        <button className="pri" onClick={nova} disabled={!d.itens.some((i) => i.tipo === 'item')}>+ Nova medição</button>
        <span className="muted pequeno">Fluxo: lançar quantidades (com memória de cálculo) → anexar fotos → enviar para análise → aprovar → imprimir boletim.</span>
      </div>
      {medicoes.length === 0 ? <div className="card vazio">Nenhuma medição registrada.</div> : (
        <div className="tabela-wrap">
          <table className="t">
            <thead><tr><th>Nº</th><th>Período</th><th>Emissão</th><th className="num">Valor do período</th><th className="num">Líquido</th><th className="num">Acumulado</th><th className="num">% exec.</th><th>Status</th><th>Relatórios</th><th /></tr></thead>
            <tbody>
              {medicoes.map((m) => {
                const b = calcularBoletim(contrato, d.itens, d.aditivos, medicoes, d.memoria, m);
                return (
                  <tr key={m.id}>
                    <td><Link to={m.id}><b>{m.numero}ª medição</b></Link></td>
                    <td>{fmtDate(m.periodoInicio)} a {fmtDate(m.periodoFim)}</td>
                    <td>{fmtDate(m.dataEmissao)}</td>
                    <td className="num">{brl(b.valorBruto)}</td>
                    <td className="num">{brl(b.valorLiquido)}</td>
                    <td className="num">{brl(b.valorAcumulado)}</td>
                    <td className="num">{num(b.percExecutado, 2)}%</td>
                    <td><StatusMedicao s={m.status} /></td>
                    <td className="nowrap pequeno">
                      <Link to={`/imprimir/boletim/${m.id}`} target="_blank">Boletim</Link> ·{' '}
                      <Link to={`/imprimir/memoria/${m.id}`} target="_blank">Memória</Link> ·{' '}
                      <Link to={`/imprimir/fotos/${m.id}`} target="_blank">Fotos</Link>
                    </td>
                    <td>
                      {m.status !== 'aprovada' && m.numero === medicoes[medicoes.length - 1].numero && (
                        <button className="mini perigo" onClick={async () => { if (confirm(`Excluir a ${m.numero}ª medição, sua memória e fotos?`)) await excluirMedicao(m.id); }}>Excluir</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
