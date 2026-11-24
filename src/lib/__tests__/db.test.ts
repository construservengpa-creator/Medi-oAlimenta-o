import { beforeEach, describe, expect, it, vi } from 'vitest';

const chamadas: { tabela: string; op: string; dados?: unknown; filtros: [string, unknown][] }[] = [];
const servidor: Record<string, Record<string, unknown>[]> = {};

vi.mock('../supabase', () => {
  const builder = (tabela: string, op: string, dados?: unknown) => {
    const c = { tabela, op, dados, filtros: [] as [string, unknown][] };
    const b = {
      eq(col: string, v: unknown) { c.filtros.push([col, v]); return b; },
      range() { return Promise.resolve({ data: servidor[tabela] ?? [], error: null }); },
      then(res: (r: { error: null }) => void) { chamadas.push(c); res({ error: null }); },
    };
    return b;
  };
  return {
    APP_ID: 'x', BUCKET_FOTOS: 'b',
    supabase: {
      from: (t: string) => ({
        select: () => builder(t, 'select'),
        insert: (d: unknown) => builder(t, 'insert', d),
        update: (d: unknown) => builder(t, 'update', d),
        upsert: (d: unknown) => builder(t, 'upsert', d),
        delete: () => builder(t, 'delete'),
      }),
    },
  };
});

const { db, flush, recarregar } = await import('../db');

describe('camada de dados', () => {
  beforeEach(() => { chamadas.length = 0; });

  it('carrega convertendo snake_case → camelCase', async () => {
    servidor.medobra_itens = [{ id: 'i1', contrato_id: 'c1', preco_unitario: 5, aditivo_id: null, ordem: 1, tipo: 'item' }];
    await recarregar();
    const i = await db.itens.get('i1');
    expect(i?.precoUnitario).toBe(5);
    expect(i?.contratoId).toBe('c1');
    expect(i?.aditivoId).toBeUndefined();
  });

  it('agrupa edições do mesmo registro em um único update e envia undefined como null', async () => {
    await db.itens.update('i1', { descricao: 'A' });
    await db.itens.update('i1', { descricao: 'AB' });
    await db.itens.update('i1', { fonte: undefined });
    expect((await db.itens.get('i1'))?.descricao).toBe('AB'); // cache imediato
    expect(chamadas.length).toBe(0);
    await flush();
    expect(chamadas).toEqual([{ tabela: 'medobra_itens', op: 'update', dados: { descricao: 'AB', fonte: null }, filtros: [['id', 'i1']] }]);
  });

  it('mantém a ordem: insert antes do update; delete descarta edição pendente', async () => {
    await db.memoria.add({ id: 'm1', contratoId: 'c1', medicaoId: 'x', itemId: 'i1', ordem: 0, descricao: '' });
    await db.memoria.update('m1', { descricao: 'sala' });
    await db.itens.update('i1', { codigo: '9' });
    await db.itens.delete('i1');
    await flush();
    expect(chamadas.map((c) => `${c.op}:${c.tabela}`)).toEqual(['insert:medobra_memoria', 'delete:medobra_itens', 'update:medobra_memoria']);
    expect(chamadas[0].dados).toEqual([{ id: 'm1', contrato_id: 'c1', medicao_id: 'x', item_id: 'i1', ordem: 0, descricao: '' }]);
  });

  it('cronograma usa chave composta', async () => {
    await db.cronograma.put({ contratoId: 'c1', itemId: 'i2', percentuais: [50, 50] });
    await db.cronograma.put({ contratoId: 'c1', itemId: 'i2', percentuais: [40, 60] });
    expect((await db.cronograma.get(['c1', 'i2']))?.percentuais).toEqual([40, 60]);
    await new Promise((r) => setTimeout(r, 700));
    await flush();
    expect(chamadas).toEqual([{ tabela: 'medobra_cronograma', op: 'upsert', dados: { contrato_id: 'c1', item_id: 'i2', percentuais: [40, 60] }, filtros: [] }]);
    await db.cronograma.delete(['c1', 'i2']);
    await flush();
    expect(chamadas[1].filtros).toEqual([['contrato_id', 'c1'], ['item_id', 'i2']]);
  });
});
