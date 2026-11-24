import { Link } from 'react-router-dom';
import { useDados } from './ContratoLayout';
import { indicadores } from '../lib/indicadores';
import { brl, fmtDate, hojeISO, num } from '../lib/format';
import { Barra, StatusMedicao } from '../components/ui';
import { valoresPorMedicao } from '../lib/calc';
import CurvaS from '../components/CurvaS';

export default function Resumo() {
  const d = useDados();
  const { contrato: c } = d;
  const ind = indicadores(d, hojeISO());
  const valores = valoresPorMedicao(d.itens, d.medicoes, d.memoria);

  return (
    <>
      <div className="grid g4">
        <div className="kpi"><div className="rot">Valor original</div><div className="val">{brl(ind.vOrig)}</div><div className="sub">BDI {num(c.bdi)}%</div></div>
        <div className="kpi"><div className="rot">Valor atual (c/ aditivos)</div><div className="val">{brl(ind.vAtual)}</div><div className="sub">{d.aditivos.length} aditivo(s)</div></div>
        <div className="kpi"><div className="rot">Medido acumulado</div><div className="val">{brl(ind.medido)}</div><div className="sub">{num(ind.percFin, 2)}% · previsto {num(ind.percPrev, 2)}%</div></div>
        <div className="kpi"><div className="rot">Saldo contratual</div><div className="val">{brl(ind.saldo)}</div></div>
        <div className="kpi"><div className="rot">Início / término</div><div className="val" style={{ fontSize: '1.05rem' }}>{fmtDate(c.dataInicio)} → {fmtDate(ind.termino)}</div><div className="sub">Prazo vigente {ind.prazo} dias</div></div>
        <div className="kpi"><div className="rot">Dias restantes</div><div className={`val ${ind.diasRestantes < 0 ? 'vermelho' : ''}`}>{ind.diasRestantes}</div><div className="sub">Prazo decorrido {num(ind.percPrazo, 1)}%</div></div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="pequeno">Avanço financeiro {num(ind.percFin, 1)}% (marca laranja = previsto no cronograma)</div>
        <Barra valor={ind.percFin} marca={ind.percPrev} />
        <div className="pequeno" style={{ marginTop: '.5rem' }}>Prazo decorrido {num(ind.percPrazo, 1)}%</div>
        <Barra valor={ind.percPrazo} cor="#8a9bb0" />
      </div>

      {ind.alertas.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Alertas</h3>
          {ind.alertas.map((a, i) => <div key={i} className={`aviso ${a.nivel === 'erro' ? 'erro' : a.nivel === 'info' ? 'ok' : ''}`}>{a.texto}</div>)}
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Curva S — previsto x realizado</h3>
          <CurvaS contrato={c} meses={ind.previsao.meses} altura={260} />
        </div>
        <div className="card">
          <div className="linha"><h3 style={{ margin: 0 }}>Medições</h3><span className="espaco" /><Link to="medicoes" className="botao mini">Ver todas</Link></div>
          {d.medicoes.length === 0 ? <p className="muted">Nenhuma medição.</p> : (
            <table className="t" style={{ marginTop: '.5rem' }}>
              <thead><tr><th>Nº</th><th>Período</th><th className="num">Valor</th><th>Status</th></tr></thead>
              <tbody>
                {[...d.medicoes].reverse().slice(0, 8).map((m) => (
                  <tr key={m.id}>
                    <td><Link to={`medicoes/${m.id}`}>{m.numero}ª</Link></td>
                    <td>{fmtDate(m.periodoInicio)} a {fmtDate(m.periodoFim)}</td>
                    <td className="num">{brl(valores.get(m.id) ?? 0)}</td>
                    <td><StatusMedicao s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dados do contrato</h3>
        <div className="grid g3 pequeno">
          <div><span className="muted">Contratante</span><br />{c.contratante} {c.cnpjContratante && `· ${c.cnpjContratante}`}</div>
          <div><span className="muted">Contratada</span><br />{c.contratada} {c.cnpjContratada && `· ${c.cnpjContratada}`}</div>
          <div><span className="muted">Local</span><br />{c.local || '—'}</div>
          <div><span className="muted">Processo</span><br />{c.processo || '—'}</div>
          <div><span className="muted">Fiscal</span><br />{c.fiscal || '—'}</div>
          <div><span className="muted">Responsável técnico</span><br />{c.responsavelTecnico || '—'}</div>
        </div>
      </div>
    </>
  );
}
