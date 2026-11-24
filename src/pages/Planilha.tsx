import { useState } from 'react';
import { useDados } from './ContratoLayout';
import { db, uid, type Item } from '../lib/db';
import { agruparPorEtapa, deltasAditivos, quantidadeAtual, valorAtual, valorOriginal } from '../lib/calc';
import { brl, num, parseNum, round2 } from '../lib/format';
import { NumInput } from '../components/ui';
import { baixarCSV, lerTabela } from '../lib/csv';

export default function Planilha() {
  const d = useDados();
  const { contrato, itens, aditivos } = d;
  const [importar, setImportar] = useState(false);
  const deltas = deltasAditivos(aditivos);
  const temMedicao = d.medicoes.length > 0;
  const proxOrdem = () => (itens.length ? Math.max(...itens.map((i) => i.ordem)) + 1 : 1);

  const atualizar = (id: string, p: Partial<Item>) => db.itens.update(id, p);

  async function adicionar(tipo: Item['tipo']) {
    const etapas = itens.filter((i) => i.tipo === 'etapa').length;
    const ultEtapa = [...itens].reverse().find((i) => i.tipo === 'etapa');
    const nItensEtapa = ultEtapa ? itens.filter((i) => i.tipo === 'item' && i.ordem > ultEtapa.ordem).length : itens.length;
    await db.itens.add({
      id: uid(), contratoId: contrato.id, ordem: proxOrdem(), tipo,
      codigo: tipo === 'etapa' ? String(etapas + 1) : `${ultEtapa?.codigo ?? ''}${ultEtapa ? '.' : ''}${nItensEtapa + 1}`,
      descricao: '', unidade: tipo === 'etapa' ? '' : 'un', quantidade: 0, precoUnitario: 0,
    });
  }

  async function mover(item: Item, dir: -1 | 1) {
    const ord = [...itens].sort((a, b) => a.ordem - b.ordem);
    const idx = ord.findIndex((i) => i.id === item.id);
    const outro = ord[idx + dir];
    if (!outro) return;
    await db.transaction('rw', db.itens, async () => {
      await db.itens.update(item.id, { ordem: outro.ordem });
      await db.itens.update(outro.id, { ordem: item.ordem });
    });
  }

  async function remover(item: Item) {
    const usado = d.memoria.some((l) => l.itemId === item.id) || d.medicoes.some((m) => (m.quantidadesManuais ?? {})[item.id]);
    if (usado) return alert('Este item já possui quantidades medidas e não pode ser excluído.');
    if (!confirm(`Excluir "${item.descricao || item.codigo}"?`)) return;
    await db.itens.delete(item.id);
    await db.cronograma.delete([contrato.id, item.id]);
  }

  function exportar() {
    const linhas: (string | number)[][] = [['Código', 'Descrição', 'Unidade', 'Quantidade', 'Preço unitário', 'Total', 'Fonte']];
    for (const i of itens) {
      if (i.tipo === 'etapa') linhas.push([i.codigo, i.descricao, '', '', '', '', '']);
      else { const q = quantidadeAtual(i, deltas); linhas.push([i.codigo, i.descricao, i.unidade, q, i.precoUnitario, round2(q * i.precoUnitario), i.fonte ?? '']); }
    }
    baixarCSV(`planilha-contrato-${contrato.numero}.csv`, linhas);
  }

  const grupos = agruparPorEtapa(itens);
  const total = valorAtual(itens, deltas);
  const nomeAditivo = new Map(aditivos.map((a) => [a.id, a.numero]));

  return (
    <>
      <div className="linha" style={{ marginBottom: '.75rem' }}>
        <button onClick={() => adicionar('etapa')}>+ Etapa</button>
        <button onClick={() => adicionar('item')}>+ Item</button>
        <button onClick={() => setImportar(true)}>Importar do Excel / CSV</button>
        <button onClick={exportar} disabled={!itens.length}>Exportar CSV</button>
        <span className="espaco" />
        <span>Original: <b>{brl(valorOriginal(itens))}</b></span>
        <span>Atual: <b>{brl(total)}</b></span>
      </div>
      {temMedicao && <div className="aviso pequeno">Já existem medições. Alterações de quantidade devem ser feitas por <b>aditivo</b> para manter o histórico; edite aqui apenas para corrigir erros de cadastro.</div>}
      {importar && <Importador contratoId={contrato.id} ordemInicial={proxOrdem()} fechar={() => setImportar(false)} />}

      {itens.length === 0 ? (
        <div className="card vazio">Planilha vazia. Adicione etapas e itens ou importe do Excel.</div>
      ) : (
        <div className="tabela-wrap">
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Código</th><th>Descrição</th><th style={{ width: 80 }}>Fonte</th><th style={{ width: 70 }}>Unid.</th>
                <th className="num" style={{ width: 120 }}>Quantidade</th><th className="num" style={{ width: 130 }}>Preço unit. (R$)</th>
                <th className="num" style={{ width: 130 }}>Total (R$)</th><th className="num" style={{ width: 60 }}>Peso</th><th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {grupos.flatMap((g) => {
                const subtotal = round2(g.itens.reduce((s, i) => s + quantidadeAtual(i, deltas) * i.precoUnitario, 0));
                return [
                  g.etapa && (
                    <tr className="etapa" key={g.etapa.id}>
                      <td><input value={g.etapa.codigo} onChange={(e) => atualizar(g.etapa!.id, { codigo: e.target.value })} /></td>
                      <td colSpan={5}><input value={g.etapa.descricao} placeholder="Nome da etapa" onChange={(e) => atualizar(g.etapa!.id, { descricao: e.target.value })} /></td>
                      <td className="num">{brl(subtotal)}</td>
                      <td className="num">{total ? num((subtotal / total) * 100, 1) : 0}%</td>
                      <td className="nowrap"><Acoes item={g.etapa} mover={mover} remover={remover} /></td>
                    </tr>
                  ),
                  ...g.itens.map((i) => {
                    const delta = deltas.get(i.id) ?? 0;
                    const q = i.quantidade + delta;
                    return (
                      <tr key={i.id}>
                        <td><input value={i.codigo} onChange={(e) => atualizar(i.id, { codigo: e.target.value })} /></td>
                        <td>
                          <input value={i.descricao} placeholder="Descrição do serviço" onChange={(e) => atualizar(i.id, { descricao: e.target.value })} />
                          {i.aditivoId && <span className="tag pri">incluído no aditivo {nomeAditivo.get(i.aditivoId)}</span>}
                        </td>
                        <td><input value={i.fonte ?? ''} onChange={(e) => atualizar(i.id, { fonte: e.target.value })} /></td>
                        <td><input value={i.unidade} onChange={(e) => atualizar(i.id, { unidade: e.target.value })} /></td>
                        <td>
                          <NumInput value={i.quantidade} casas={4} onCommit={(v) => atualizar(i.id, { quantidade: v ?? 0 })} />
                          {delta !== 0 && <div className="pequeno direita muted">aditivo {delta > 0 ? '+' : ''}{num(delta, 4)} = {num(q, 4)}</div>}
                        </td>
                        <td><NumInput value={i.precoUnitario} onCommit={(v) => atualizar(i.id, { precoUnitario: v ?? 0 })} /></td>
                        <td className="num">{num(round2(q * i.precoUnitario))}</td>
                        <td className="num">{total ? num(((q * i.precoUnitario) / total) * 100, 1) : 0}%</td>
                        <td className="nowrap"><Acoes item={i} mover={mover} remover={remover} /></td>
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="total"><td colSpan={6}>TOTAL GERAL</td><td className="num">{brl(total)}</td><td className="num">100%</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Acoes({ item, mover, remover }: { item: Item; mover: (i: Item, d: -1 | 1) => void; remover: (i: Item) => void }) {
  return (
    <>
      <button className="mini" title="Subir" onClick={() => mover(item, -1)}>↑</button>{' '}
      <button className="mini" title="Descer" onClick={() => mover(item, 1)}>↓</button>{' '}
      <button className="mini perigo" title="Excluir" onClick={() => remover(item)}>✕</button>
    </>
  );
}

function Importador({ contratoId, ordemInicial, fechar }: { contratoId: string; ordemInicial: number; fechar: () => void }) {
  const [txt, setTxt] = useState('');
  // ignora cabeçalho: linha cuja descrição contém "descri" e sem quantidade numérica
  const linhas = lerTabela(txt).filter((l) => !(/descri/i.test(l[1] ?? '') && !parseNum(l[3])));
  const itens: Omit<Item, 'id' | 'contratoId' | 'ordem'>[] = linhas
    .filter((l) => l.some((c) => c))
    .map((l) => {
      const [codigo = '', descricao = '', unidade = '', qtd = '', pu = '', fonte = ''] = l;
      const ehEtapa = !unidade && !qtd && !pu;
      return { tipo: ehEtapa ? 'etapa' : 'item', codigo, descricao, unidade, quantidade: ehEtapa ? 0 : parseNum(qtd), precoUnitario: ehEtapa ? 0 : parseNum(pu), fonte: fonte || undefined };
    });

  async function confirmar() {
    await db.itens.bulkAdd(itens.map((i, k) => ({ ...i, id: uid(), contratoId, ordem: ordemInicial + k })));
    fechar();
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Importar planilha</h3>
      <p className="muted pequeno">
        Copie as linhas do Excel e cole abaixo, nesta ordem de colunas: <b>Código · Descrição · Unidade · Quantidade · Preço unitário · Fonte (opcional)</b>.
        Linhas sem unidade, quantidade e preço viram <b>etapas</b>. A linha de cabeçalho é ignorada.
      </p>
      <textarea rows={8} style={{ width: '100%', fontFamily: 'monospace' }} value={txt} onChange={(e) => setTxt(e.target.value)}
        placeholder={'1\tSERVIÇOS PRELIMINARES\n1.1\tPlaca de obra em chapa galvanizada\tm²\t6\t450,00\tSINAPI 74209/1'} />
      {itens.length > 0 && (
        <p className="pequeno">{itens.filter((i) => i.tipo === 'etapa').length} etapa(s) e {itens.filter((i) => i.tipo === 'item').length} item(ns) ·
          total {brl(itens.reduce((s, i) => s + round2(i.quantidade * i.precoUnitario), 0))}</p>
      )}
      <div className="linha">
        <button className="pri" disabled={!itens.length} onClick={confirmar}>Importar {itens.length} linha(s)</button>
        <button onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}
