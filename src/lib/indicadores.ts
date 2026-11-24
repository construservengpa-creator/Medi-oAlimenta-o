import type { DadosContrato } from './hooks';
import {
  dataTermino, deltasAditivos, percPrazoDecorrido, percPrevistoAte, previsaoFinanceira, prazoVigente,
  quantidadeAtual, quantidadesMedicao, resumoAditivos, valorAtual, valorOriginal, valoresPorMedicao,
} from './calc';
import { brl, diffDias, fmtDate, num } from './format';

export interface Alerta {
  nivel: 'erro' | 'alerta' | 'info';
  texto: string;
}

export function indicadores(d: DadosContrato, hoje: string) {
  const { contrato, itens, aditivos, medicoes, memoria, cronograma } = d;
  const deltas = deltasAditivos(aditivos);
  const vOrig = valorOriginal(itens);
  const vAtual = valorAtual(itens, deltas);
  const valores = valoresPorMedicao(itens, medicoes, memoria);
  const medido = [...valores.values()].reduce((a, b) => a + b, 0);
  const prev = previsaoFinanceira(contrato, itens, aditivos, cronograma, medicoes, memoria, hoje);
  const percFin = vAtual ? (medido / vAtual) * 100 : 0;
  const percPrev = percPrevistoAte(prev.meses, contrato, hoje);
  const percPrazo = percPrazoDecorrido(contrato, aditivos, hoje);
  const termino = dataTermino(contrato, aditivos);
  const diasRestantes = diffDias(hoje, termino);
  const ra = resumoAditivos(itens, aditivos);

  const alertas: Alerta[] = [];
  if (!itens.some((i) => i.tipo === 'item')) alertas.push({ nivel: 'info', texto: 'Planilha orçamentária ainda não cadastrada.' });
  else if (prev.semCronograma > 0.01) alertas.push({ nivel: 'alerta', texto: `Cronograma incompleto: ${brl(prev.semCronograma)} sem distribuição mensal.` });
  if (contrato.status === 'ativo') {
    if (diasRestantes < 0) alertas.push({ nivel: 'erro', texto: `Prazo vencido em ${fmtDate(termino)} (${-diasRestantes} dias).` });
    else if (diasRestantes <= 30) alertas.push({ nivel: 'alerta', texto: `Prazo termina em ${diasRestantes} dias (${fmtDate(termino)}).` });
    if (percPrev - percFin > 5) alertas.push({ nivel: 'alerta', texto: `Execução atrasada: ${num(percFin, 1)}% medido x ${num(percPrev, 1)}% previsto.` });
  }
  // itens com quantidade medida acima da contratada
  const acum = new Map<string, number>();
  for (const m of medicoes) for (const [k, v] of quantidadesMedicao(m, memoria)) acum.set(k, (acum.get(k) ?? 0) + v);
  const excedidos = itens.filter((i) => i.tipo === 'item' && (acum.get(i.id) ?? 0) - quantidadeAtual(i, deltas) > 1e-6);
  if (excedidos.length) alertas.push({ nivel: 'erro', texto: `${excedidos.length} item(ns) com quantidade medida acima da contratada: ${excedidos.slice(0, 3).map((i) => i.codigo).join(', ')}${excedidos.length > 3 ? '…' : ''}. Avalie aditivo.` });
  if (ra.percAcrescimo > 25) alertas.push({ nivel: 'erro', texto: `Acréscimos somam ${num(ra.percAcrescimo, 2)}% do valor original (limite legal de 25%).` });
  else if (ra.percAcrescimo > 20) alertas.push({ nivel: 'alerta', texto: `Acréscimos já somam ${num(ra.percAcrescimo, 2)}% do valor original (limite 25%).` });
  if (ra.percSupressao > 25) alertas.push({ nivel: 'erro', texto: `Supressões somam ${num(ra.percSupressao, 2)}% do valor original (limite legal de 25%).` });
  const pend = medicoes.filter((m) => m.status !== 'aprovada');
  if (pend.length) alertas.push({ nivel: 'info', texto: `${pend.length} medição(ões) aguardando aprovação.` });

  return {
    vOrig, vAtual, medido, saldo: vAtual - medido, percFin, percPrev, percPrazo, termino, diasRestantes,
    prazo: prazoVigente(contrato, aditivos), alertas, previsao: prev, aditivos: ra,
  };
}
