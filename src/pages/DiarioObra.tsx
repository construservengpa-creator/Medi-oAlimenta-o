import { useLiveQuery } from '../lib/hooks';
import { useState } from 'react';
import { useDados } from './ContratoLayout';
import { usePerm } from '../lib/acesso';
import { db, uid, type Diario } from '../lib/db';
import { fmtDate, hojeISO } from '../lib/format';

const CLIMAS = ['Bom', 'Nublado', 'Chuva fraca', 'Chuva forte (impraticável)'];

export default function DiarioObra() {
  const perm = usePerm();
  const { contrato } = useDados();
  const registros = useLiveQuery(() => db.diario.where('contratoId').equals(contrato.id).reverse().sortBy('data'), [contrato.id]) ?? [];
  const [aberto, setAberto] = useState<string | null>(null);
  const diasChuva = registros.filter((r) => r.climaManha.startsWith('Chuva forte') || r.climaTarde.startsWith('Chuva forte')).length;

  async function novo() {
    const id = uid();
    await db.diario.add({ id, contratoId: contrato.id, data: hojeISO(), climaManha: 'Bom', climaTarde: 'Bom', maoDeObra: '', equipamentos: '', atividades: '', ocorrencias: '' });
    setAberto(id);
  }
  const upd = (r: Diario, p: Partial<Diario>) => db.diario.update(r.id, p);

  return (
    <fieldset className="leitura" disabled={!(perm.lancar || perm.aprovar)}>
      {!(perm.lancar || perm.aprovar) && <div className="aviso pequeno">Somente a equipe de medição/fiscalização registra o diário. Você está em modo de consulta.</div>}
      <div className="linha" style={{ marginBottom: '.75rem' }}>
        <button className="pri" onClick={novo}>+ Registro do dia</button>
        <span className="muted pequeno">{registros.length} registro(s) · {diasChuva} dia(s) impraticáveis por chuva (base para pedido de prorrogação)</span>
      </div>
      {registros.map((r) => (
        <div className="card" key={r.id}>
          <div className="linha" onClick={() => setAberto(aberto === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
            <b>{fmtDate(r.data)}</b>
            <span className="tag">{r.climaManha} / {r.climaTarde}</span>
            <span className="muted pequeno" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 700 }}>{r.atividades}</span>
            <span className="espaco" />
            {r.ocorrencias && <span className="tag alerta">ocorrência</span>}
          </div>
          {aberto === r.id && (
            <div style={{ marginTop: '.75rem' }}>
              <div className="grid g4">
                <label className="campo">Data<input type="date" value={r.data} onChange={(e) => upd(r, { data: e.target.value })} /></label>
                <label className="campo">Clima manhã<select value={r.climaManha} onChange={(e) => upd(r, { climaManha: e.target.value })}>{CLIMAS.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="campo">Clima tarde<select value={r.climaTarde} onChange={(e) => upd(r, { climaTarde: e.target.value })}>{CLIMAS.map((c) => <option key={c}>{c}</option>)}</select></label>
              </div>
              <div className="grid g2" style={{ marginTop: '.5rem' }}>
                <label className="campo">Mão de obra (efetivo)<textarea rows={3} value={r.maoDeObra} placeholder="Ex.: 1 encarregado, 4 pedreiros, 6 serventes" onChange={(e) => upd(r, { maoDeObra: e.target.value })} /></label>
                <label className="campo">Equipamentos<textarea rows={3} value={r.equipamentos} onChange={(e) => upd(r, { equipamentos: e.target.value })} /></label>
                <label className="campo">Atividades executadas<textarea rows={4} value={r.atividades} onChange={(e) => upd(r, { atividades: e.target.value })} /></label>
                <label className="campo">Ocorrências / observações da fiscalização<textarea rows={4} value={r.ocorrencias} onChange={(e) => upd(r, { ocorrencias: e.target.value })} /></label>
              </div>
              <button className="mini perigo" style={{ marginTop: '.5rem' }} onClick={() => confirm('Excluir registro?') && db.diario.delete(r.id)}>Excluir registro</button>
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
