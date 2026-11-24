import { describe, expect, it } from 'vitest';
import { avaliar } from '../expr';
import { calcularBoletim, previsaoFinanceira, quantidadesMedicao, resumoAditivos } from '../calc';
import { parseNum } from '../format';
import type { Aditivo, Contrato, CronogramaLinha, Item, Medicao, MemoriaLinha } from '../db';

const contrato: Contrato = {
  id: 'c', numero: '1', objeto: 'x', contratante: 'A', contratada: 'B', dataInicio: '2026-01-10', prazoDias: 90,
  mesesCronograma: 3, bdi: 25, retencoes: [{ nome: 'INSS', percentual: 11, base: 50 }], status: 'ativo', criadoEm: '',
};
const item = (id: string, ordem: number, q: number, pu: number, tipo: Item['tipo'] = 'item'): Item => ({
  id, contratoId: 'c', ordem, tipo, codigo: id, descricao: id, unidade: 'm²', quantidade: q, precoUnitario: pu,
});
const itens = [item('E1', 1, 0, 0, 'etapa'), item('A', 2, 100, 10), item('B', 3, 50, 20)];
const med = (id: string, numero: number, fim: string, manual: Record<string, number> = {}): Medicao => ({
  id, contratoId: 'c', numero, periodoInicio: '2026-01-10', periodoFim: fim, dataEmissao: fim, status: 'aprovada', reajustePercentual: 0, quantidadesManuais: manual,
});
const linha = (medicaoId: string, itemId: string, p: Partial<MemoriaLinha>): MemoriaLinha => ({
  id: Math.random().toString(), contratoId: 'c', medicaoId, itemId, ordem: 0, descricao: '', ...p,
});

describe('expressões', () => {
  it('avalia com vírgula decimal e precedência', () => {
    expect(avaliar('(3,20+2,80)*2*2,70 - 0,80*2,10')).toBeCloseTo(30.72);
    expect(avaliar('2x3')).toBe(6);
    expect(() => avaliar('2*alert(1)')).toThrow();
  });
  it('converte números brasileiros', () => {
    expect(parseNum('1.234,56')).toBe(1234.56);
    expect(parseNum('1234.56')).toBe(1234.56);
    expect(parseNum('R$ 10,5')).toBe(10.5);
  });
});

describe('medição', () => {
  const m1 = med('m1', 1, '2026-01-31');
  const m2 = med('m2', 2, '2026-02-28', { B: 10 });
  const memoria = [
    linha('m1', 'A', { n: 2, c: 5, l: 3 }), // 30
    linha('m1', 'A', { formula: '-2' }), // dedução
    linha('m2', 'A', { c: 80 }),
  ];

  it('soma memória e usa valor manual quando não há memória', () => {
    expect(quantidadesMedicao(m1, memoria).get('A')).toBe(28);
    expect(quantidadesMedicao(m2, memoria).get('B')).toBe(10);
  });

  it('calcula boletim com acumulado, retenções e excedente', () => {
    const b = calcularBoletim(contrato, itens, [], [m1, m2], memoria, m2);
    const a = b.linhas.find((l) => l.item.id === 'A')!;
    expect(a.qtdAnterior).toBe(28);
    expect(a.qtdAcumulada).toBe(108);
    expect(a.excedido).toBe(true);
    expect(b.valorPeriodo).toBe(800 + 200);
    expect(b.retencoes[0].valor).toBe(55); // 11% de 50% de 1000
    expect(b.valorLiquido).toBe(945);
    expect(b.valorContratado).toBe(2000);
  });

  it('considera aditivos na quantidade contratada', () => {
    const ad: Aditivo = { id: 'ad', contratoId: 'c', numero: '1', data: '', dias: 30, descricao: '', alteracoes: [{ itemId: 'A', delta: 20 }, { itemId: 'B', delta: -5 }] };
    const b = calcularBoletim(contrato, itens, [ad], [m1, m2], memoria, m2);
    expect(b.linhas.find((l) => l.item.id === 'A')!.excedido).toBe(false);
    const r = resumoAditivos(itens, [ad]);
    expect(r.acrescimos).toBe(200);
    expect(r.supressoes).toBe(100);
    expect(r.percAcrescimo).toBeCloseTo(10);
  });
});

describe('previsão financeira', () => {
  const cron: CronogramaLinha[] = [
    { contratoId: 'c', itemId: 'A', percentuais: [50, 50, 0] },
    { contratoId: 'c', itemId: 'B', percentuais: [0, 50, 50] },
  ];
  it('gera previsto mensal e reprograma o saldo', () => {
    const m1 = med('m1', 1, '2026-01-31', { A: 20 }); // 200 medido no mês 1 (previsto 500)
    const { meses, total } = previsaoFinanceira(contrato, itens, [], cron, [m1], [], '2026-02-15');
    expect(total).toBe(2000);
    expect(meses.map((m) => m.previsto)).toEqual([500, 1000, 500]);
    expect(meses[0].medido).toBe(200);
    expect(meses[1].medido).toBeNull();
    // saldo 1800 redistribuído 1000:500 nos meses 2 e 3
    expect(meses[1].reprogramado).toBe(1200);
    expect(meses[2].reprogramado).toBe(600);
    expect(meses[2].reprogramadoAcum).toBe(2000);
  });
});

describe('consistência', () => {
  it('valor por medição bate com o boletim', async () => {
    const { valoresPorMedicao } = await import('../calc');
    const its = [item('X', 1, 10, 96.4), item('Y', 2, 10, 685.2)];
    const ms = [med('a', 1, '2026-01-31', { X: 2.835, Y: 1.3333 }), med('b', 2, '2026-02-28', { X: 4.4475, Y: 2.7777 })];
    const v = valoresPorMedicao(its, ms, []);
    const b2 = calcularBoletim(contrato, its, [], ms, [], ms[1]);
    expect(v.get('b')).toBe(b2.valorPeriodo);
    expect((v.get('a') ?? 0) + (v.get('b') ?? 0)).toBeCloseTo(b2.valorAcumulado, 2);
  });
});
