import { useState } from 'react';
import { useDados } from './ContratoLayout';
import { db, uid, type Aditivo } from '../lib/db';
import { resumoAditivos, valorOriginal, valorAtual, deltasAditivos, dataTermino, prazoVigente } from '../lib/calc';
import { brl, fmtDate, hojeISO, num, round2 } from '../lib/format';
import { NumInput } from '../components/ui';

export default function Aditivos() {
  const { contrato, itens, aditivos } = useDados();
  const [edit, setEdit] = useState<string | null>(null);
  const r = resumoAditivos(itens, aditivos);
  const servicos = itens.filter((i) => i.tipo === 'item');
  const pu = new Map(servicos.map((i) => [i.id, i]));

  async function novo() {
    const id = uid();
    await db.aditivos.add({ id, contratoId: contrato.id, numero: `${aditivos.length + 1}º TA`, data: hojeISO(), dias: 0, descricao: '', alteracoes: [] });
    setEdit(id);
  }
  const upd = (a: Aditivo, p: Partial<Aditivo>) => db.aditivos.update(a.id, p);

  async function novoItem(a: Aditivo) {
    const ordem = itens.length ? Math.max(...itens.map((i) => i.ordem)) + 1 : 1;
    await db.itens.add({ id: uid(), contratoId: contrato.id, ordem, tipo: 'item', codigo: `AD${a.numero.replace(/\D/g, '')}.${itens.filter((i) => i.aditivoId === a.id).length + 1}`, descricao: '', unidade: 'un', quantidade: 0, precoUnitario: 0, aditivoId: a.id });
    alert('Item incluído no fim da planilha. Complete descrição, unidade, quantidade e preço na aba Planilha (mova-o para a etapa correta com ↑/↓).');
  }

  return (
    <>
      <div className="grid g4">
        <div className="kpi"><div className="rot">Valor original</div><div className="val">{brl(valorOriginal(itens))}</div></div>
        <div className="kpi"><div className="rot">Acréscimos</div><div className={`val ${r.percAcrescimo > 25 ? 'vermelho' : ''}`}>{brl(r.acrescimos)}</div><div className="sub">{num(r.percAcrescimo)}% do original (limite 25%)</div></div>
        <div className="kpi"><div className="rot">Supressões</div><div className={`val ${r.percSupressao > 25 ? 'vermelho' : ''}`}>{brl(r.supressoes)}</div><div className="sub">{num(r.percSupressao)}% do original (limite 25%)</div></div>
        <div className="kpi"><div className="rot">Valor atual / prazo</div><div className="val">{brl(valorAtual(itens, deltasAditivos(aditivos)))}</div><div className="sub">{prazoVigente(contrato, aditivos)} dias (+{r.diasAditados}) · término {fmtDate(dataTermino(contrato, aditivos))}</div></div>
      </div>
      <p className="muted pequeno">Limites de referência: art. 125 da Lei 14.133/2021 (25% para obras e serviços; 50% em reforma de edifício ou equipamento, para acréscimos). Os percentuais são calculados sobre o valor original atualizado — confira com o jurídico do contratante.</p>

      <div className="linha" style={{ margin: '1rem 0 .5rem' }}><button className="pri" onClick={novo}>+ Novo termo aditivo</button></div>
      {aditivos.length === 0 && <div className="card vazio">Nenhum aditivo.</div>}
      {aditivos.map((a) => {
        const aberto = edit === a.id;
        const valorAlt = round2(a.alteracoes.reduce((s, x) => s + x.delta * (pu.get(x.itemId)?.precoUnitario ?? 0), 0) + itens.filter((i) => i.aditivoId === a.id).reduce((s, i) => s + i.quantidade * i.precoUnitario, 0));
        return (
          <div className="card" key={a.id}>
            <div className="linha">
              <b>{a.numero}</b><span className="muted">{fmtDate(a.data)}</span>
              {a.dias !== 0 && <span className="tag pri">{a.dias > 0 ? '+' : ''}{a.dias} dias</span>}
              {valorAlt !== 0 && <span className={`tag ${valorAlt > 0 ? 'ok' : 'erro'}`}>{valorAlt > 0 ? '+' : ''}{brl(valorAlt)}</span>}
              <span className="muted">{a.descricao}</span>
              <span className="espaco" />
              <button className="mini" onClick={() => setEdit(aberto ? null : a.id)}>{aberto ? 'Fechar' : 'Editar'}</button>
              <button className="mini perigo" onClick={async () => {
                if (itens.some((i) => i.aditivoId === a.id)) return alert('Remova antes os itens incluídos por este aditivo na planilha.');
                if (confirm('Excluir aditivo?')) await db.aditivos.delete(a.id);
              }}>Excluir</button>
            </div>
            {aberto && (
              <div style={{ marginTop: '.75rem' }}>
                <div className="grid g4">
                  <label className="campo">Número<input value={a.numero} onChange={(e) => upd(a, { numero: e.target.value })} /></label>
                  <label className="campo">Data<input type="date" value={a.data} onChange={(e) => upd(a, { data: e.target.value })} /></label>
                  <label className="campo">Prorrogação de prazo (dias)<input type="number" value={a.dias} onChange={(e) => upd(a, { dias: Number(e.target.value) })} /></label>
                </div>
                <label className="campo" style={{ marginTop: '.5rem' }}>Justificativa / descrição<textarea rows={2} value={a.descricao} onChange={(e) => upd(a, { descricao: e.target.value })} /></label>
                <h3>Acréscimos e supressões de quantidades</h3>
                <table className="t">
                  <thead><tr><th>Item</th><th className="num">Qtd original</th><th className="num" style={{ width: 140 }}>Variação (+/−)</th><th className="num">Valor</th><th /></tr></thead>
                  <tbody>
                    {a.alteracoes.map((alt, k) => {
                      const it = pu.get(alt.itemId);
                      return (
                        <tr key={k}>
                          <td>
                            <select value={alt.itemId} onChange={(e) => upd(a, { alteracoes: a.alteracoes.map((x, j) => (j === k ? { ...x, itemId: e.target.value } : x)) })}>
                              {servicos.map((i) => <option key={i.id} value={i.id}>{i.codigo} {i.descricao.slice(0, 60)}</option>)}
                            </select>
                          </td>
                          <td className="num">{it && `${num(it.quantidade, 4)} ${it.unidade}`}</td>
                          <td><NumInput value={alt.delta} casas={4} onCommit={(v) => upd(a, { alteracoes: a.alteracoes.map((x, j) => (j === k ? { ...x, delta: v ?? 0 } : x)) })} /></td>
                          <td className={`num ${alt.delta < 0 ? 'vermelho' : ''}`}>{brl(alt.delta * (it?.precoUnitario ?? 0))}</td>
                          <td><button className="mini perigo" onClick={() => upd(a, { alteracoes: a.alteracoes.filter((_, j) => j !== k) })}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="linha" style={{ marginTop: '.5rem' }}>
                  <button disabled={!servicos.length} onClick={() => upd(a, { alteracoes: [...a.alteracoes, { itemId: servicos[0].id, delta: 0 }] })}>+ Alterar quantidade de item existente</button>
                  <button onClick={() => novoItem(a)}>+ Incluir novo item (serviço extracontratual)</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
