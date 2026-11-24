import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDados } from './ContratoLayout';
import { db, enviarFoto, excluirFoto, uid, type Foto, type Item, type Medicao, type MemoriaLinha, type StatusMedicao as SM } from '../lib/db';
import { agruparPorEtapa, calcularBoletim, resultadoLinha, type LinhaBoletim } from '../lib/calc';
import { brl, fmtDate, num } from '../lib/format';
import { NumInput, StatusMedicao } from '../components/ui';
import { comprimirImagem } from '../lib/image';
import { useFotoURL, useLiveQuery } from '../lib/hooks';
import { usePerm } from '../lib/acesso';
import { baixarCSV } from '../lib/csv';

type Aba = 'quantidades' | 'memoria' | 'fotos';

export default function MedicaoEditor() {
  const { mid } = useParams();
  const d = useDados();
  const m = d.medicoes.find((x) => x.id === mid);
  const [aba, setAba] = useState<Aba>('quantidades');
  const [itemSel, setItemSel] = useState<string | null>(null);
  const perm = usePerm();
  if (!m) return <p>Medição não encontrada.</p>;

  const b = calcularBoletim(d.contrato, d.itens, d.aditivos, d.medicoes, d.memoria, m);
  const bloqueada = m.status === 'aprovada' || !(perm.lancar || perm.aprovar);
  const upd = (p: Partial<Medicao>) => db.medicoes.update(m.id, p);
  const excedidos = b.linhas.filter((l) => l.excedido);

  async function mudarStatus(s: SM) {
    if (s === 'aprovada') {
      if (excedidos.length && !confirm(`${excedidos.length} item(ns) ultrapassam a quantidade contratada. Aprovar mesmo assim?`)) return;
      if (!confirm('Aprovar a medição? Ela ficará bloqueada para edição.')) return;
    }
    if (m!.status === 'aprovada' && !confirm('Reabrir uma medição aprovada? As medições seguintes podem ser afetadas.')) return;
    await upd({ status: s });
  }

  function exportarCSV() {
    baixarCSV(`boletim-${d.contrato.numero}-med${m!.numero}.csv`, [
      ['Código', 'Descrição', 'Unid.', 'Qtd contratada', 'Preço unit.', 'Valor contratado', 'Qtd anterior', 'Qtd período', 'Qtd acumulada', 'Saldo qtd', 'Valor período', 'Valor acumulado', '% acumulado'],
      ...b.linhas.map((l) => [l.item.codigo, l.item.descricao, l.item.unidade, l.qtdContratada, l.item.precoUnitario, l.valorContratado, l.qtdAnterior, l.qtdPeriodo, l.qtdAcumulada, l.saldoQtd, l.valorPeriodo, l.valorAcumulado, +l.percAcumulado.toFixed(2)]),
      [],
      ['Valor do período', b.valorPeriodo], ['Reajuste', b.reajuste], ['Valor bruto', b.valorBruto],
      ...b.retencoes.map((r) => [`(-) ${r.nome}`, r.valor]), ['Valor líquido', b.valorLiquido],
    ]);
  }

  return (
    <>
      <div className="linha">
        <Link to="..">← Medições</Link>
        <h2 style={{ margin: 0 }}>{m.numero}ª medição</h2>
        <StatusMedicao s={m.status} />
        <span className="espaco" />
        <Link className="botao" to={`/imprimir/boletim/${m.id}`} target="_blank">Boletim</Link>
        <Link className="botao" to={`/imprimir/memoria/${m.id}`} target="_blank">Memória de cálculo</Link>
        <Link className="botao" to={`/imprimir/fotos/${m.id}`} target="_blank">Relatório fotográfico</Link>
        <button onClick={exportarCSV}>CSV</button>
      </div>

      <div className="card" style={{ marginTop: '.75rem' }}>
        <div className="grid g4">
          <label className="campo">Período — início<input type="date" disabled={bloqueada} value={m.periodoInicio} onChange={(e) => upd({ periodoInicio: e.target.value })} /></label>
          <label className="campo">Período — fim<input type="date" disabled={bloqueada} value={m.periodoFim} onChange={(e) => upd({ periodoFim: e.target.value })} /></label>
          <label className="campo">Data de emissão<input type="date" disabled={bloqueada} value={m.dataEmissao} onChange={(e) => upd({ dataEmissao: e.target.value })} /></label>
          <label className="campo">Reajuste sobre o período (%)<NumInput disabled={bloqueada} value={m.reajustePercentual} casas={4} onCommit={(v) => upd({ reajustePercentual: v ?? 0 })} /></label>
        </div>
        <label className="campo" style={{ marginTop: '.75rem' }}>Observações (saem no boletim)
          <textarea rows={2} disabled={bloqueada} value={m.observacoes ?? ''} onChange={(e) => upd({ observacoes: e.target.value })} />
        </label>
        <div className="linha" style={{ marginTop: '.75rem' }}>
          <b>Situação:</b>
          {m.status === 'rascunho' && (perm.lancar || perm.aprovar) && <button className="pri" onClick={() => mudarStatus('em_analise')}>Enviar para análise da fiscalização</button>}
          {m.status === 'rascunho' && <span className="muted">Em elaboração.</span>}
          {m.status === 'em_analise' && (perm.aprovar
            ? <><button className="pri" onClick={() => mudarStatus('aprovada')}>Aprovar medição</button><button onClick={() => mudarStatus('rascunho')}>Devolver para correção</button></>
            : <span className="muted">Aguardando a fiscalização.</span>)}
          {m.status === 'aprovada' && <><span className="verde">Aprovada — edição bloqueada.</span>{perm.aprovar && <button onClick={() => mudarStatus('em_analise')}>Reabrir</button>}</>}
          <span className="espaco" />
          <span className="muted pequeno">
            {m.enviadoPorNome && <>Enviada por {m.enviadoPorNome} em {new Date(m.enviadoEm!).toLocaleString('pt-BR')}. </>}
            {m.aprovadoPorNome && <>Aprovada por {m.aprovadoPorNome} em {new Date(m.aprovadoEm!).toLocaleString('pt-BR')}.</>}
          </span>
        </div>
      </div>

      <div className="grid g4">
        <div className="kpi"><div className="rot">Valor do período</div><div className="val">{brl(b.valorPeriodo)}</div>{b.reajuste !== 0 && <div className="sub">+ reajuste {brl(b.reajuste)}</div>}</div>
        <div className="kpi"><div className="rot">Retenções</div><div className="val">{brl(b.totalRetencoes)}</div><div className="sub">{b.retencoes.map((r) => r.nome).join(', ') || 'nenhuma configurada'}</div></div>
        <div className="kpi"><div className="rot">Valor líquido a pagar</div><div className="val verde">{brl(b.valorLiquido)}</div></div>
        <div className="kpi"><div className="rot">Acumulado / executado</div><div className="val">{brl(b.valorAcumulado)}</div><div className="sub">{num(b.percExecutado, 2)}% · saldo {brl(b.saldoContratual)}</div></div>
      </div>
      {excedidos.length > 0 && <div className="aviso erro">Quantidade acumulada acima da contratada em: {excedidos.map((l) => l.item.codigo).join(', ')}. Corrija a medição ou formalize aditivo.</div>}

      <nav className="abas">
        {(['quantidades', 'memoria', 'fotos'] as Aba[]).map((a) => (
          <a key={a} href="#" className={aba === a ? 'active' : ''} onClick={(e) => { e.preventDefault(); setAba(a); }}>
            {{ quantidades: 'Quantidades medidas', memoria: 'Memória de cálculo', fotos: 'Relatório fotográfico' }[a]}
          </a>
        ))}
      </nav>

      {aba === 'quantidades' && <Quantidades m={m} linhas={b.linhas} itens={d.itens} memoria={d.memoria} bloqueada={bloqueada} abrirMemoria={(id) => { setItemSel(id); setAba('memoria'); }} />}
      {aba === 'memoria' && <Memoria m={m} linhas={b.linhas} memoria={d.memoria.filter((l) => l.medicaoId === m.id)} bloqueada={bloqueada} itemSel={itemSel} setItemSel={setItemSel} />}
      {aba === 'fotos' && <Fotos m={m} itens={d.itens} bloqueada={bloqueada} />}
    </>
  );
}

/* ---------------- Quantidades ---------------- */

function Quantidades({ m, linhas, itens, memoria, bloqueada, abrirMemoria }: {
  m: Medicao; linhas: LinhaBoletim[]; itens: Item[]; memoria: MemoriaLinha[]; bloqueada: boolean; abrirMemoria: (id: string) => void;
}) {
  const [soMedidos, setSoMedidos] = useState(false);
  const [busca, setBusca] = useState('');
  const porItem = new Map(linhas.map((l) => [l.item.id, l]));
  const nLinhas = (id: string) => memoria.filter((l) => l.medicaoId === m.id && l.itemId === id).length;
  const filtro = (l: LinhaBoletim) =>
    (!soMedidos || l.qtdPeriodo !== 0) && (!busca || `${l.item.codigo} ${l.item.descricao}`.toLowerCase().includes(busca.toLowerCase()));

  async function setManual(itemId: string, v: number | null) {
    const q = { ...(m.quantidadesManuais ?? {}) };
    if (v === null || v === 0) delete q[itemId];
    else q[itemId] = v;
    await db.medicoes.update(m.id, { quantidadesManuais: q });
  }

  return (
    <>
      <div className="linha" style={{ marginBottom: '.5rem' }}>
        <input placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="linha pequeno"><input type="checkbox" checked={soMedidos} onChange={(e) => setSoMedidos(e.target.checked)} /> somente itens medidos no período</label>
        <span className="espaco" />
        <span className="muted pequeno">Itens com memória de cálculo têm a quantidade calculada automaticamente.</span>
      </div>
      <div className="tabela-wrap">
        <table className="t">
          <thead>
            <tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="num">Contratado</th><th className="num">P. unit.</th><th className="num">Acum. anterior</th>
              <th className="num" style={{ width: 130 }}>Medido no período</th><th className="num">Acumulado</th><th className="num">Saldo</th><th className="num">% acum.</th><th className="num">Valor período</th><th /></tr>
          </thead>
          <tbody>
            {agruparPorEtapa(itens).flatMap((g) => {
              const ls = g.itens.map((i) => porItem.get(i.id)!).filter(Boolean).filter(filtro);
              if (!ls.length) return [];
              const rows = [];
              if (g.etapa) rows.push(<tr key={g.etapa.id} className="etapa"><td>{g.etapa.codigo}</td><td colSpan={9}>{g.etapa.descricao}</td><td className="num">{num(ls.reduce((s, l) => s + l.valorPeriodo, 0))}</td><td /></tr>);
              for (const l of ls) {
                const nm = nLinhas(l.item.id);
                rows.push(
                  <tr key={l.item.id}>
                    <td>{l.item.codigo}</td><td>{l.item.descricao}</td><td>{l.item.unidade}</td>
                    <td className="num">{num(l.qtdContratada, 4)}</td><td className="num">{num(l.item.precoUnitario)}</td><td className="num">{num(l.qtdAnterior, 4)}</td>
                    <td>{nm > 0 ? <div className="direita"><b>{num(l.qtdPeriodo, 4)}</b></div> : <NumInput value={l.qtdPeriodo} casas={4} vazio disabled={bloqueada} onCommit={(v) => setManual(l.item.id, v)} />}</td>
                    <td className={`num ${l.excedido ? 'vermelho' : ''}`}>{num(l.qtdAcumulada, 4)}</td>
                    <td className={`num ${l.excedido ? 'vermelho' : ''}`}>{num(l.saldoQtd, 4)}</td>
                    <td className="num">{num(l.percAcumulado, 1)}%</td>
                    <td className="num">{num(l.valorPeriodo)}</td>
                    <td><button className="mini" onClick={() => abrirMemoria(l.item.id)}>{nm ? `memória (${nm})` : '+ memória'}</button></td>
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Memória de cálculo ---------------- */

function Memoria({ m, linhas, memoria, bloqueada, itemSel, setItemSel }: {
  m: Medicao; linhas: LinhaBoletim[]; memoria: MemoriaLinha[]; bloqueada: boolean; itemSel: string | null; setItemSel: (id: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const sel = linhas.find((l) => l.item.id === itemSel);
  const doItem = memoria.filter((l) => l.itemId === itemSel).sort((a, b) => a.ordem - b.ordem);
  const totalItem = doItem.reduce((s, l) => s + resultadoLinha(l).valor, 0);

  async function adicionar() {
    if (!itemSel) return;
    // se havia quantidade manual, ela será substituída pela memória
    if (m.quantidadesManuais?.[itemSel] && !doItem.length) {
      const q = m.quantidadesManuais[itemSel];
      const qm = { ...m.quantidadesManuais };
      delete qm[itemSel];
      await db.medicoes.update(m.id, { quantidadesManuais: qm });
      await db.memoria.add({ id: uid(), contratoId: m.contratoId, medicaoId: m.id, itemId: itemSel, ordem: 0, descricao: 'Quantidade lançada anteriormente', n: q });
    }
    await db.memoria.add({ id: uid(), contratoId: m.contratoId, medicaoId: m.id, itemId: itemSel, ordem: Date.now(), descricao: '' });
  }
  const upd = (id: string, p: Partial<MemoriaLinha>) => db.memoria.update(id, p);

  const lista = linhas.filter((l) => !busca || `${l.item.codigo} ${l.item.descricao}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr', alignItems: 'start' }}>
      <div className="card" style={{ maxHeight: '70vh', overflow: 'auto', padding: '.6rem' }}>
        <input placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', marginBottom: '.5rem' }} />
        {lista.map((l) => {
          const n = memoria.filter((x) => x.itemId === l.item.id).length;
          return (
            <div key={l.item.id} onClick={() => setItemSel(l.item.id)}
              style={{ padding: '.35rem .45rem', borderRadius: 6, cursor: 'pointer', background: l.item.id === itemSel ? 'var(--pri-claro)' : undefined }}>
              <div className="pequeno"><b>{l.item.codigo}</b> {l.item.descricao}</div>
              <div className="pequeno muted">{n ? `${n} linha(s) · ${num(l.qtdPeriodo, 4)} ${l.item.unidade}` : l.qtdPeriodo ? `manual: ${num(l.qtdPeriodo, 4)} ${l.item.unidade}` : '—'}</div>
            </div>
          );
        })}
      </div>

      <div className="card">
        {!sel ? <p className="muted">Selecione um item à esquerda para lançar a memória de cálculo.</p> : (
          <>
            <h3 style={{ marginTop: 0 }}>{sel.item.codigo} — {sel.item.descricao} ({sel.item.unidade})</h3>
            <div className="pequeno muted" style={{ marginBottom: '.5rem' }}>
              Contratado {num(sel.qtdContratada, 4)} · anterior {num(sel.qtdAnterior, 4)} · saldo antes desta medição {num(sel.qtdContratada - sel.qtdAnterior, 4)}
            </div>
            <p className="pequeno muted">Resultado = Qtd × Comp. × Larg. × Alt. (campos vazios são ignorados). Ou escreva uma fórmula, ex.: <code>(3,20+2,80)*2*2,70 - 0,80*2,10</code>. Use quantidade negativa para deduções (vãos, aberturas).</p>
            <div className="tabela-wrap">
              <table className="t">
                <thead><tr><th>Descrição / local</th><th className="num" style={{ width: 80 }}>Qtd (n)</th><th className="num" style={{ width: 90 }}>Comp.</th><th className="num" style={{ width: 90 }}>Larg.</th><th className="num" style={{ width: 90 }}>Alt.</th><th style={{ width: 200 }}>Fórmula</th><th className="num" style={{ width: 110 }}>Resultado</th><th /></tr></thead>
                <tbody>
                  {doItem.map((l) => {
                    const r = resultadoLinha(l);
                    const dims = (k: 'n' | 'c' | 'l' | 'h') => <NumInput value={l[k]} casas={k === 'n' ? 2 : 3} disabled={bloqueada || !!l.formula} onCommit={(v) => upd(l.id, { [k]: v })} />;
                    return (
                      <tr key={l.id}>
                        <td><input disabled={bloqueada} value={l.descricao} placeholder="Ex.: Sala 01 — parede norte" onChange={(e) => upd(l.id, { descricao: e.target.value })} /></td>
                        <td>{dims('n')}</td><td>{dims('c')}</td><td>{dims('l')}</td><td>{dims('h')}</td>
                        <td><input disabled={bloqueada} value={l.formula ?? ''} onChange={(e) => upd(l.id, { formula: e.target.value })} title={r.erro} style={r.erro ? { borderColor: 'var(--erro)' } : undefined} /></td>
                        <td className={`num ${r.valor < 0 ? 'vermelho' : ''}`}>{r.erro ? <span className="vermelho" title={r.erro}>erro</span> : num(r.valor, 4)}</td>
                        <td>{!bloqueada && <button className="mini perigo" onClick={() => db.memoria.delete(l.id)}>✕</button>}</td>
                      </tr>
                    );
                  })}
                  <tr className="total"><td colSpan={6}>Total medido no período ({sel.item.unidade})</td><td className="num">{num(totalItem, 4)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            {!bloqueada && <button style={{ marginTop: '.6rem' }} onClick={adicionar}>+ Linha</button>}
            {sel.qtdAnterior + totalItem - sel.qtdContratada > 1e-6 && <div className="aviso erro">O acumulado ({num(sel.qtdAnterior + totalItem, 4)}) ultrapassa o contratado ({num(sel.qtdContratada, 4)}).</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Fotos ---------------- */

function Fotos({ m, itens, bloqueada }: { m: Medicao; itens: Item[]; bloqueada: boolean }) {
  const fotos = useLiveQuery(() => db.fotos.where('medicaoId').equals(m.id).sortBy('ordem'), [m.id]) ?? [];
  const [enviando, setEnviando] = useState(0);
  const servicos = useMemo(() => itens.filter((i) => i.tipo === 'item'), [itens]);

  async function adicionar(files: FileList | null) {
    if (!files) return;
    const lista = Array.from(files);
    setEnviando(lista.length);
    let ordem = fotos.length ? Math.max(...fotos.map((f) => f.ordem)) + 1 : 1;
    for (const f of lista) {
      try {
        const blob = await comprimirImagem(f);
        const data = new Date(f.lastModified || Date.now()).toISOString().slice(0, 10);
        await enviarFoto({ id: uid(), contratoId: m.contratoId, medicaoId: m.id, legenda: '', data, ordem: ordem++ }, blob);
      } catch (e) {
        alert(`Não foi possível ler ${f.name}: ${(e as Error).message}`);
      }
      setEnviando((n) => n - 1);
    }
  }

  async function mover(f: Foto, dir: -1 | 1) {
    const idx = fotos.findIndex((x) => x.id === f.id);
    const o = fotos[idx + dir];
    if (!o) return;
    await db.fotos.update(f.id, { ordem: o.ordem });
    await db.fotos.update(o.id, { ordem: f.ordem });
  }

  return (
    <>
      <div className="card linha">
        {!bloqueada && (
          <label className="botao pri">
            + Adicionar fotos
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
          </label>
        )}
        {enviando > 0 && <span className="muted">Processando {enviando} foto(s)…</span>}
        <span className="muted pequeno">As fotos são reduzidas automaticamente. Vincule cada foto ao serviço executado e escreva uma legenda — elas saem no relatório fotográfico, agrupadas por item.</span>
      </div>
      {fotos.length === 0 ? <div className="card vazio">Nenhuma foto nesta medição.</div> : (
        <div className="fotos">
          {fotos.map((f, k) => (
            <CartaoFoto key={f.id} f={f} n={k + 1} servicos={servicos} bloqueada={bloqueada} mover={mover} />
          ))}
        </div>
      )}
    </>
  );
}

function CartaoFoto({ f, n, servicos, bloqueada, mover }: { f: Foto; n: number; servicos: Item[]; bloqueada: boolean; mover: (f: Foto, d: -1 | 1) => void }) {
  const url = useFotoURL(f.caminho);
  const upd = (p: Partial<Foto>) => db.fotos.update(f.id, p);
  return (
    <div className="foto">
      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={f.legenda} /></a>
      <div className="corpo">
        <div className="linha pequeno"><b>Foto {n}</b><span className="espaco" />
          {!bloqueada && <><button className="mini" onClick={() => mover(f, -1)}>←</button><button className="mini" onClick={() => mover(f, 1)}>→</button>
            <button className="mini perigo" onClick={() => confirm('Excluir foto?') && excluirFoto(f)}>✕</button></>}
        </div>
        <select disabled={bloqueada} value={f.itemId ?? ''} onChange={(e) => upd({ itemId: e.target.value || undefined })}>
          <option value="">— serviço (geral) —</option>
          {servicos.map((i) => <option key={i.id} value={i.id}>{i.codigo} {i.descricao.slice(0, 50)}</option>)}
        </select>
        <textarea disabled={bloqueada} rows={2} placeholder="Legenda" value={f.legenda} onChange={(e) => upd({ legenda: e.target.value })} />
        <div className="linha">
          <input disabled={bloqueada} style={{ flex: 1 }} placeholder="Local" value={f.local ?? ''} onChange={(e) => upd({ local: e.target.value })} />
          <input disabled={bloqueada} type="date" value={f.data} onChange={(e) => upd({ data: e.target.value })} title={fmtDate(f.data)} />
        </div>
      </div>
    </div>
  );
}
