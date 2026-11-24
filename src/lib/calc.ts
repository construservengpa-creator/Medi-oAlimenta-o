import type { Aditivo, Contrato, CronogramaLinha, Item, Medicao, MemoriaLinha } from './db';
import { tentarAvaliar } from './expr';
import { addDias, diffDias, indiceMes, round2 } from './format';

/* ---------------- Planilha / aditivos ---------------- */

export function deltasAditivos(aditivos: Aditivo[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of aditivos) for (const alt of a.alteracoes) m.set(alt.itemId, (m.get(alt.itemId) ?? 0) + alt.delta);
  return m;
}

export function quantidadeAtual(item: Item, deltas: Map<string, number>): number {
  return item.quantidade + (deltas.get(item.id) ?? 0);
}

export function valorOriginal(itens: Item[]): number {
  return round2(itens.filter((i) => i.tipo === 'item' && !i.aditivoId).reduce((s, i) => s + round2(i.quantidade * i.precoUnitario), 0));
}

export function valorAtual(itens: Item[], deltas: Map<string, number>): number {
  return round2(itens.filter((i) => i.tipo === 'item').reduce((s, i) => s + round2(quantidadeAtual(i, deltas) * i.precoUnitario), 0));
}

export interface ResumoAditivos {
  acrescimos: number;
  supressoes: number;
  percAcrescimo: number;
  percSupressao: number;
  diasAditados: number;
}

/** Acréscimos/supressões em valor, para o controle do limite legal (Lei 14.133/21, art. 125: 25%). */
export function resumoAditivos(itens: Item[], aditivos: Aditivo[]): ResumoAditivos {
  const pu = new Map(itens.map((i) => [i.id, i.precoUnitario]));
  let acrescimos = 0;
  let supressoes = 0;
  for (const i of itens) if (i.tipo === 'item' && i.aditivoId) acrescimos += round2(i.quantidade * i.precoUnitario);
  for (const a of aditivos)
    for (const alt of a.alteracoes) {
      const v = round2(alt.delta * (pu.get(alt.itemId) ?? 0));
      if (v >= 0) acrescimos += v;
      else supressoes += -v;
    }
  const orig = valorOriginal(itens) || 1;
  return {
    acrescimos: round2(acrescimos),
    supressoes: round2(supressoes),
    percAcrescimo: (acrescimos / orig) * 100,
    percSupressao: (supressoes / orig) * 100,
    diasAditados: aditivos.reduce((s, a) => s + (a.dias || 0), 0),
  };
}

export function prazoVigente(c: Contrato, aditivos: Aditivo[]): number {
  return c.prazoDias + aditivos.reduce((s, a) => s + (a.dias || 0), 0);
}

export function dataTermino(c: Contrato, aditivos: Aditivo[]): string {
  return addDias(c.dataInicio, prazoVigente(c, aditivos));
}

/** Agrupa itens por etapa (na ordem da planilha). Itens antes da 1ª etapa ficam em um grupo sem etapa. */
export function agruparPorEtapa(itens: Item[]): { etapa?: Item; itens: Item[] }[] {
  const ord = [...itens].sort((a, b) => a.ordem - b.ordem);
  const grupos: { etapa?: Item; itens: Item[] }[] = [];
  let atual: { etapa?: Item; itens: Item[] } | null = null;
  for (const i of ord) {
    if (i.tipo === 'etapa') {
      atual = { etapa: i, itens: [] };
      grupos.push(atual);
    } else {
      if (!atual) {
        atual = { itens: [] };
        grupos.push(atual);
      }
      atual.itens.push(i);
    }
  }
  return grupos;
}

/* ---------------- Memória de cálculo ---------------- */

export function resultadoLinha(l: MemoriaLinha): { valor: number; erro?: string } {
  if (l.formula && l.formula.trim()) return tentarAvaliar(l.formula);
  const fatores = [l.n, l.c, l.l, l.h].filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (fatores.length === 0) return { valor: 0 };
  return { valor: fatores.reduce((a, b) => a * b, 1) };
}

/** Quantidade medida de cada item numa medição: soma da memória de cálculo; sem memória, usa o valor manual. */
export function quantidadesMedicao(m: Medicao, memoria: MemoriaLinha[]): Map<string, number> {
  const q = new Map<string, number>();
  const comMemoria = new Set<string>();
  for (const l of memoria) {
    if (l.medicaoId !== m.id) continue;
    comMemoria.add(l.itemId);
    q.set(l.itemId, (q.get(l.itemId) ?? 0) + resultadoLinha(l).valor);
  }
  for (const [itemId, v] of Object.entries(m.quantidadesManuais ?? {})) if (!comMemoria.has(itemId)) q.set(itemId, v);
  for (const [k, v] of q) q.set(k, Math.round(v * 10000) / 10000);
  return q;
}

/* ---------------- Medições ---------------- */

export interface LinhaBoletim {
  item: Item;
  qtdContratada: number;
  valorContratado: number;
  qtdAnterior: number;
  qtdPeriodo: number;
  qtdAcumulada: number;
  saldoQtd: number;
  valorAnterior: number;
  valorPeriodo: number;
  valorAcumulado: number;
  percAcumulado: number;
  excedido: boolean;
}

export interface Boletim {
  linhas: LinhaBoletim[];
  valorContratado: number;
  valorAnterior: number;
  valorPeriodo: number;
  reajuste: number;
  valorBruto: number;
  retencoes: { nome: string; percentual: number; base: number; valor: number }[];
  totalRetencoes: number;
  valorLiquido: number;
  valorAcumulado: number;
  saldoContratual: number;
  percExecutado: number;
}

export function calcularBoletim(
  contrato: Contrato,
  itens: Item[],
  aditivos: Aditivo[],
  medicoes: Medicao[],
  memoria: MemoriaLinha[],
  medicao: Medicao,
): Boletim {
  const deltas = deltasAditivos(aditivos);
  const anteriores = medicoes.filter((m) => m.numero < medicao.numero);
  const qAnt = new Map<string, number>();
  for (const m of anteriores) for (const [k, v] of quantidadesMedicao(m, memoria)) qAnt.set(k, (qAnt.get(k) ?? 0) + v);
  const qPer = quantidadesMedicao(medicao, memoria);

  const linhas: LinhaBoletim[] = [];
  for (const item of [...itens].sort((a, b) => a.ordem - b.ordem)) {
    if (item.tipo !== 'item') continue;
    const qtdContratada = quantidadeAtual(item, deltas);
    const qtdAnterior = qAnt.get(item.id) ?? 0;
    const qtdPeriodo = qPer.get(item.id) ?? 0;
    const qtdAcumulada = qtdAnterior + qtdPeriodo;
    const valorAnterior = round2(qtdAnterior * item.precoUnitario);
    const valorAcumulado = round2(qtdAcumulada * item.precoUnitario);
    linhas.push({
      item,
      qtdContratada,
      valorContratado: round2(qtdContratada * item.precoUnitario),
      qtdAnterior,
      qtdPeriodo,
      qtdAcumulada,
      saldoQtd: qtdContratada - qtdAcumulada,
      valorAnterior,
      valorPeriodo: round2(valorAcumulado - valorAnterior),
      valorAcumulado,
      percAcumulado: qtdContratada ? (qtdAcumulada / qtdContratada) * 100 : 0,
      excedido: qtdAcumulada - qtdContratada > 1e-6,
    });
  }
  const soma = (f: (l: LinhaBoletim) => number) => round2(linhas.reduce((s, l) => s + f(l), 0));
  const valorContratado = soma((l) => l.valorContratado);
  const valorAnterior = soma((l) => l.valorAnterior);
  const valorPeriodo = soma((l) => l.valorPeriodo);
  const reajuste = round2((valorPeriodo * (medicao.reajustePercentual || 0)) / 100);
  const valorBruto = round2(valorPeriodo + reajuste);
  const retencoes = (contrato.retencoes ?? []).map((r) => ({
    ...r,
    valor: round2((valorBruto * (r.base / 100) * r.percentual) / 100),
  }));
  const totalRetencoes = round2(retencoes.reduce((s, r) => s + r.valor, 0));
  const valorAcumulado = round2(valorAnterior + valorPeriodo);
  return {
    linhas,
    valorContratado,
    valorAnterior,
    valorPeriodo,
    reajuste,
    valorBruto,
    retencoes,
    totalRetencoes,
    valorLiquido: round2(valorBruto - totalRetencoes),
    valorAcumulado,
    saldoContratual: round2(valorContratado - valorAcumulado),
    percExecutado: valorContratado ? (valorAcumulado / valorContratado) * 100 : 0,
  };
}

/**
 * Valor medido (sem reajuste) de cada medição, pelo mesmo critério do boletim:
 * valor do período = round(acumulado atual × PU) − round(acumulado anterior × PU), item a item.
 */
export function valoresPorMedicao(itens: Item[], medicoes: Medicao[], memoria: MemoriaLinha[]): Map<string, number> {
  const pu = new Map(itens.map((i) => [i.id, i.precoUnitario]));
  const acum = new Map<string, number>();
  const r = new Map<string, number>();
  for (const m of [...medicoes].sort((a, b) => a.numero - b.numero)) {
    let v = 0;
    for (const [k, q] of quantidadesMedicao(m, memoria)) {
      const p = pu.get(k) ?? 0;
      const antes = acum.get(k) ?? 0;
      v += round2((antes + q) * p) - round2(antes * p);
      acum.set(k, antes + q);
    }
    r.set(m.id, round2(v));
  }
  return r;
}

/* ---------------- Cronograma físico-financeiro / previsão ---------------- */

export interface MesPrevisao {
  indice: number;
  previsto: number;
  previstoAcum: number;
  percPrevistoAcum: number;
  medido: number | null;
  medidoAcum: number | null;
  percMedidoAcum: number | null;
  reprogramado: number;
  reprogramadoAcum: number;
  percReprogramadoAcum: number;
}

export function previsaoFinanceira(
  contrato: Contrato,
  itens: Item[],
  aditivos: Aditivo[],
  cronograma: CronogramaLinha[],
  medicoes: Medicao[],
  memoria: MemoriaLinha[],
  hoje: string,
): { meses: MesPrevisao[]; total: number; semCronograma: number } {
  const deltas = deltasAditivos(aditivos);
  const total = valorAtual(itens, deltas);
  const cron = new Map(cronograma.map((c) => [c.itemId, c.percentuais]));
  const nMeses = Math.max(
    contrato.mesesCronograma,
    ...medicoes.map((m) => indiceMes(contrato.dataInicio, m.periodoFim) + 1),
    1,
  );

  const previsto = new Array(nMeses).fill(0);
  let semCronograma = 0;
  for (const i of itens) {
    if (i.tipo !== 'item') continue;
    const v = quantidadeAtual(i, deltas) * i.precoUnitario;
    const p = cron.get(i.id) ?? [];
    const somaP = p.reduce((a, b) => a + (b || 0), 0);
    if (somaP < 99.99) semCronograma += (v * (100 - somaP)) / 100;
    p.forEach((perc, k) => {
      if (k < nMeses) previsto[k] += (v * (perc || 0)) / 100;
    });
  }

  const valores = valoresPorMedicao(itens, medicoes, memoria);
  const medido = new Array(nMeses).fill(0);
  for (const m of medicoes) {
    const k = indiceMes(contrato.dataInicio, m.periodoFim);
    if (k >= 0 && k < nMeses) medido[k] += valores.get(m.id) ?? 0;
  }
  const mesAtual = indiceMes(contrato.dataInicio, hoje);
  // último mês com medição (realizado conhecido)
  const ultimoMedido = Math.max(-1, ...medicoes.map((m) => indiceMes(contrato.dataInicio, m.periodoFim)));
  const corte = Math.max(ultimoMedido, Math.min(mesAtual - 1, nMeses - 1));

  // reprogramação: o saldo é redistribuído nos meses futuros, proporcional ao previsto deles
  const medidoTotal = medido.reduce((a, b) => a + b, 0);
  const saldo = Math.max(0, total - medidoTotal);
  const futuros = previsto.map((p, k) => (k > corte ? p : 0));
  const somaFut = futuros.reduce((a, b) => a + b, 0);
  const nFut = nMeses - 1 - corte;

  const meses: MesPrevisao[] = [];
  let pa = 0;
  let ma = 0;
  let ra = 0;
  for (let k = 0; k < nMeses; k++) {
    pa += previsto[k];
    const temRealizado = k <= corte;
    if (temRealizado) ma += medido[k];
    let rep: number;
    if (temRealizado) rep = medido[k];
    else if (somaFut > 0) rep = (saldo * futuros[k]) / somaFut;
    else rep = nFut > 0 ? saldo / nFut : 0;
    ra += rep;
    meses.push({
      indice: k,
      previsto: round2(previsto[k]),
      previstoAcum: round2(pa),
      percPrevistoAcum: total ? (pa / total) * 100 : 0,
      medido: temRealizado ? round2(medido[k]) : null,
      medidoAcum: temRealizado ? round2(ma) : null,
      percMedidoAcum: temRealizado && total ? (ma / total) * 100 : null,
      reprogramado: round2(rep),
      reprogramadoAcum: round2(ra),
      percReprogramadoAcum: total ? (ra / total) * 100 : 0,
    });
  }
  return { meses, total, semCronograma: round2(semCronograma) };
}

/** % físico previsto até a data informada (interpolando dentro do mês). */
export function percPrevistoAte(meses: MesPrevisao[], contrato: Contrato, data: string): number {
  const k = indiceMes(contrato.dataInicio, data);
  if (k < 0) return 0;
  if (k >= meses.length) return meses.length ? meses[meses.length - 1].percPrevistoAcum : 0;
  const ant = k > 0 ? meses[k - 1].percPrevistoAcum : 0;
  const dia = Number(data.slice(8, 10));
  return ant + ((meses[k].percPrevistoAcum - ant) * Math.min(dia, 30)) / 30;
}

export function percPrazoDecorrido(c: Contrato, aditivos: Aditivo[], hoje: string): number {
  const p = prazoVigente(c, aditivos);
  if (!p) return 0;
  return Math.max(0, Math.min(100, (diffDias(c.dataInicio, hoje) / p) * 100));
}
