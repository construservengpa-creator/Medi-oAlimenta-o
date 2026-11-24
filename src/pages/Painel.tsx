import { useLiveQuery } from '../lib/hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import type { DadosContrato } from '../lib/hooks';
import { indicadores } from '../lib/indicadores';
import { brl, hojeISO, num, fmtDate } from '../lib/format';
import { Barra, StatusContrato } from '../components/ui';
import { carregarExemplo } from '../lib/exemplo';
import { usePerm } from '../lib/acesso';

export default function Painel() {
  const perm = usePerm();
  const dados = useLiveQuery(async () => {
    const contratos = await db.contratos.toArray();
    return Promise.all(
      contratos.map(async (contrato): Promise<DadosContrato> => ({
        contrato,
        itens: await db.itens.where('contratoId').equals(contrato.id).sortBy('ordem'),
        aditivos: await db.aditivos.where('contratoId').equals(contrato.id).toArray(),
        medicoes: await db.medicoes.where('contratoId').equals(contrato.id).sortBy('numero'),
        memoria: await db.memoria.where('contratoId').equals(contrato.id).toArray(),
        cronograma: await db.cronograma.where('contratoId').equals(contrato.id).toArray(),
      })),
    );
  });
  if (!dados) return null;
  const hoje = hojeISO();
  const lista = dados.map((d) => ({ d, ind: indicadores(d, hoje) }));
  const ativos = lista.filter((x) => x.d.contrato.status === 'ativo');
  const tot = (f: (x: (typeof lista)[number]) => number) => ativos.reduce((s, x) => s + f(x), 0);

  return (
    <>
      <div className="linha">
        <div>
          <h1>Painel de contratos</h1>
          <div className="muted">Visão geral da carteira em {fmtDate(hoje)}</div>
        </div>
        <span className="espaco" />
        {perm.admin && <Link to="/contratos/novo" className="botao pri">+ Novo contrato</Link>}
      </div>

      {lista.length === 0 ? (
        <div className="card vazio">
          <p>Nenhum contrato {perm.admin ? 'cadastrado' : 'liberado para você'}.</p>
          {perm.admin && (
            <div className="linha" style={{ justifyContent: 'center' }}>
              <Link to="/contratos/novo" className="botao pri">Cadastrar contrato</Link>
              <button onClick={() => carregarExemplo()}>Criar contrato de exemplo</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid g4" style={{ margin: '1rem 0' }}>
            <div className="kpi"><div className="rot">Contratos ativos</div><div className="val">{ativos.length}</div><div className="sub">de {lista.length} cadastrados</div></div>
            <div className="kpi"><div className="rot">Valor contratado (ativos)</div><div className="val">{brl(tot((x) => x.ind.vAtual))}</div></div>
            <div className="kpi"><div className="rot">Medido acumulado</div><div className="val">{brl(tot((x) => x.ind.medido))}</div></div>
            <div className="kpi"><div className="rot">Saldo a medir</div><div className="val">{brl(tot((x) => x.ind.saldo))}</div></div>
          </div>
          <div className="contratos">
            {lista.map(({ d, ind }) => (
              <Link key={d.contrato.id} to={`/contratos/${d.contrato.id}`} className="card contrato-card">
                <div className="linha">
                  <strong>Contrato {d.contrato.numero}</strong>
                  <span className="espaco" />
                  <StatusContrato s={d.contrato.status} />
                </div>
                <div className="muted pequeno" style={{ margin: '.25rem 0 .6rem' }}>{d.contrato.objeto}</div>
                <div className="grid g2" style={{ gap: '.4rem' }}>
                  <div><span className="muted pequeno">Valor atual</span><br /><b>{brl(ind.vAtual)}</b></div>
                  <div><span className="muted pequeno">Medido</span><br /><b>{brl(ind.medido)}</b></div>
                </div>
                <div style={{ marginTop: '.6rem' }} className="pequeno">
                  Financeiro {num(ind.percFin, 1)}% <span className="muted">(previsto {num(ind.percPrev, 1)}%)</span>
                  <Barra valor={ind.percFin} marca={ind.percPrev} />
                </div>
                <div style={{ marginTop: '.4rem' }} className="pequeno">
                  Prazo decorrido {num(ind.percPrazo, 1)}% <span className="muted">· término {fmtDate(ind.termino)}</span>
                  <Barra valor={ind.percPrazo} cor="#8a9bb0" />
                </div>
                {ind.alertas.filter((a) => a.nivel !== 'info').slice(0, 3).map((a, i) => (
                  <div key={i} className={`aviso pequeno ${a.nivel === 'erro' ? 'erro' : ''}`}>{a.texto}</div>
                ))}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
