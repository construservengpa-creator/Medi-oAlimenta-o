import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from './ContratoLayout';
import { usePerm } from '../lib/acesso';
import { db, type Item } from '../lib/db';
import { agruparPorEtapa, deltasAditivos, quantidadeAtual, valorAtual } from '../lib/calc';
import { brl, num, rotuloMes } from '../lib/format';
import { NumInput } from '../components/ui';
import GraficoAvanco from '../components/GraficoAvanco';

export default function Cronograma() {
  const perm = usePerm();
  const dados = useDados();
  const { contrato, itens, aditivos, cronograma } = dados;
  const n = contrato.mesesCronograma;
  const deltas = deltasAditivos(aditivos);
  const total = valorAtual(itens, deltas);
  const mapa = new Map(cronograma.map((c) => [c.itemId, c.percentuais]));
  const [sel, setSel] = useState<Item | null>(null);
  const [de, setDe] = useState(0);
  const [ate, setAte] = useState(n - 1);
  const [modo, setModo] = useState<'%' | 'R$'>('%');

  const perc = (id: string) => { const p = mapa.get(id) ?? []; return Array.from({ length: n }, (_, k) => p[k] ?? 0); };
  const valorItem = (i: Item) => quantidadeAtual(i, deltas) * i.precoUnitario;
  const grupos = agruparPorEtapa(itens);

  const salvar = (itemId: string, percentuais: number[]) => db.cronograma.put({ contratoId: contrato.id, itemId, percentuais });

  function alvo(): Item[] {
    if (!sel) return [];
    if (sel.tipo === 'item') return [sel];
    return grupos.find((g) => g.etapa?.id === sel.id)?.itens ?? [];
  }

  async function distribuir() {
    const a = Math.min(de, ate), b = Math.max(de, ate);
    const qtd = b - a + 1;
    const base = Math.floor((100 / qtd) * 100) / 100;
    const p = Array.from({ length: n }, (_, k) => (k >= a && k <= b ? base : 0));
    p[b] = Math.round((100 - base * (qtd - 1)) * 100) / 100; // fecha 100%
    await Promise.all(alvo().map((i) => salvar(i.id, p)));
  }
  async function limpar() {
    await Promise.all(alvo().map((i) => salvar(i.id, new Array(n).fill(0))));
  }
  async function copiarParaEtapa() {
    if (!sel || sel.tipo !== 'item') return;
    const g = grupos.find((x) => x.itens.some((i) => i.id === sel.id));
    const p = perc(sel.id);
    await Promise.all((g?.itens ?? []).map((i) => salvar(i.id, p)));
  }

  const mensal = Array.from({ length: n }, (_, k) => itens.reduce((s, i) => (i.tipo === 'item' ? s + (valorItem(i) * (perc(i.id)[k] || 0)) / 100 : s), 0));
  let acum = 0;
  const acumulado = mensal.map((v) => (acum += v));

  if (!itens.some((i) => i.tipo === 'item')) return <div className="card vazio">Cadastre a planilha orçamentária antes de montar o cronograma.</div>;

  return (
    <fieldset className="leitura" disabled={!perm.admin}>
      <GraficoAvanco d={dados} />
      {!perm.admin && <div className="aviso pequeno">Somente administradores alteram o cronograma. Você está em modo de consulta.</div>}
      <div className="card">
        <div className="linha">
          <span><b>Selecionado:</b> {sel ? `${sel.codigo} ${sel.descricao}` : <span className="muted">clique em uma linha (item ou etapa)</span>}</span>
          <span className="espaco" />
          <div className="linha">
            Exibir
            <select value={modo} onChange={(e) => setModo(e.target.value as '%' | 'R$')}><option>%</option><option>R$</option></select>
            <Link className="botao" to={`/imprimir/cronograma/${contrato.id}`} target="_blank">Imprimir cronograma</Link>
          </div>
        </div>
        <div className="linha" style={{ marginTop: '.6rem' }}>
          Distribuir de
          <select value={de} onChange={(e) => setDe(Number(e.target.value))}>{Array.from({ length: n }, (_, k) => <option key={k} value={k}>{k + 1} · {rotuloMes(contrato.dataInicio, k)}</option>)}</select>
          até
          <select value={ate} onChange={(e) => setAte(Number(e.target.value))}>{Array.from({ length: n }, (_, k) => <option key={k} value={k}>{k + 1} · {rotuloMes(contrato.dataInicio, k)}</option>)}</select>
          <button className="pri" disabled={!sel} onClick={distribuir}>Distribuir uniformemente {sel?.tipo === 'etapa' ? '(todos os itens da etapa)' : ''}</button>
          <button disabled={!sel || sel.tipo !== 'item'} onClick={copiarParaEtapa}>Copiar distribuição para a etapa</button>
          <button disabled={!sel} onClick={limpar}>Limpar</button>
        </div>
        <p className="muted pequeno" style={{ marginBottom: 0 }}>Informe o percentual de execução de cada item em cada mês. A soma de cada linha deve fechar 100%. Para mudar o número de meses, edite os dados do contrato.</p>
      </div>

      <div className="tabela-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Código</th><th style={{ minWidth: 220 }}>Descrição</th><th className="num">Valor</th><th className="num">Peso</th>
              {Array.from({ length: n }, (_, k) => <th key={k} className="num" style={{ minWidth: 78 }}>Mês {k + 1}<br /><span className="muted">{rotuloMes(contrato.dataInicio, k)}</span></th>)}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {grupos.flatMap((g) => {
              const vEtapa = g.itens.reduce((s, i) => s + valorItem(i), 0);
              const mEtapa = Array.from({ length: n }, (_, k) => g.itens.reduce((s, i) => s + (valorItem(i) * perc(i.id)[k]) / 100, 0));
              const linhas = [];
              if (g.etapa)
                linhas.push(
                  <tr key={g.etapa.id} className={`etapa ${sel?.id === g.etapa.id ? 'sel' : ''}`} onClick={() => setSel(g.etapa!)} style={{ cursor: 'pointer' }}>
                    <td>{g.etapa.codigo}</td><td>{g.etapa.descricao}</td><td className="num">{num(vEtapa)}</td><td className="num">{total ? num((vEtapa / total) * 100, 1) : 0}%</td>
                    {mEtapa.map((v, k) => <td key={k} className="num">{v ? (modo === '%' ? `${num(vEtapa ? (v / vEtapa) * 100 : 0, 1)}%` : num(v)) : ''}</td>)}
                    <td className="num">{vEtapa ? num((mEtapa.reduce((a, b) => a + b, 0) / vEtapa) * 100, 1) : 0}%</td>
                  </tr>,
                );
              for (const i of g.itens) {
                const p = perc(i.id);
                const soma = p.reduce((a, b) => a + b, 0);
                const v = valorItem(i);
                linhas.push(
                  <tr key={i.id} className={sel?.id === i.id ? 'sel' : ''} onClick={() => setSel(i)}>
                    <td>{i.codigo}</td><td>{i.descricao}</td><td className="num">{num(v)}</td><td className="num">{total ? num((v / total) * 100, 2) : 0}%</td>
                    {p.map((x, k) => (
                      <td key={k} style={{ padding: 2 }}>
                        {modo === '%' ? (
                          <NumInput value={x} vazio onCommit={(nv) => { const np = [...p]; np[k] = nv ?? 0; salvar(i.id, np); }} />
                        ) : <div className="direita">{x ? num((v * x) / 100) : ''}</div>}
                      </td>
                    ))}
                    <td className={`num ${Math.abs(soma - 100) > 0.01 ? 'vermelho' : 'verde'}`}>{num(soma, 2)}%</td>
                  </tr>,
                );
              }
              return linhas;
            })}
          </tbody>
          <tfoot>
            <tr className="total"><td colSpan={4}>Previsto no mês (R$)</td>{mensal.map((v, k) => <td key={k} className="num">{num(v)}</td>)}<td className="num">{brl(acumulado[n - 1] ?? 0)}</td></tr>
            <tr className="total"><td colSpan={4}>Previsto no mês (%)</td>{mensal.map((v, k) => <td key={k} className="num">{total ? num((v / total) * 100, 2) : 0}%</td>)}<td /></tr>
            <tr className="total"><td colSpan={4}>Acumulado (R$)</td>{acumulado.map((v, k) => <td key={k} className="num">{num(v)}</td>)}<td /></tr>
            <tr className="total"><td colSpan={4}>Acumulado (%)</td>{acumulado.map((v, k) => <td key={k} className="num">{total ? num((v / total) * 100, 2) : 0}%</td>)}<td /></tr>
          </tfoot>
        </table>
      </div>
    </fieldset>
  );
}
