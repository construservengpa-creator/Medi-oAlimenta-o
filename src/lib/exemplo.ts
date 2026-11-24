import { db, uid, type Item, type MemoriaLinha } from './db';
import { addDias, hojeISO } from './format';

/** Cria um contrato de demonstração com planilha, cronograma e duas medições. */
export async function carregarExemplo() {
  const hoje = hojeISO();
  const [y, m] = hoje.split('-').map(Number);
  const ini = new Date(y, m - 4, 1);
  const dataInicio = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}-01`;
  const cid = uid();
  await db.contratos.add({
    id: cid, numero: '012/2026', processo: 'Concorrência 004/2026', objeto: 'Reforma e ampliação da Escola Municipal Exemplo',
    contratante: 'Prefeitura Municipal de Exemplo', cnpjContratante: '00.000.000/0001-00', contratada: 'Construtora Modelo Ltda.',
    cnpjContratada: '11.111.111/0001-11', local: 'Rua das Flores, 100 — Centro', dataAssinatura: addDias(dataInicio, -10), dataInicio,
    prazoDias: 180, mesesCronograma: 6, bdi: 24.5, fiscal: 'Eng. Fiscal da Prefeitura', responsavelTecnico: 'Eng. Responsável — CREA 000000',
    retencoes: [{ nome: 'INSS', percentual: 11, base: 50 }, { nome: 'ISS', percentual: 5, base: 50 }],
    status: 'ativo', criadoEm: new Date().toISOString(),
  });
  const base: [Item['tipo'], string, string, string, number, number, number[]][] = [
    ['etapa', '1', 'SERVIÇOS PRELIMINARES', '', 0, 0, []],
    ['item', '1.1', 'Placa de obra em chapa galvanizada', 'm²', 6, 452.3, [100]],
    ['item', '1.2', 'Locação convencional de obra com gabarito', 'm²', 320, 8.75, [100]],
    ['item', '1.3', 'Demolição de alvenaria de tijolos', 'm³', 18, 96.4, [60, 40]],
    ['etapa', '2', 'INFRAESTRUTURA E ESTRUTURA', '', 0, 0, []],
    ['item', '2.1', 'Escavação manual de vala', 'm³', 42, 78.9, [50, 50]],
    ['item', '2.2', 'Concreto fck 25 MPa, lançado e adensado', 'm³', 38, 685.2, [0, 40, 40, 20]],
    ['item', '2.3', 'Armação de aço CA-50', 'kg', 2850, 14.6, [0, 40, 40, 20]],
    ['etapa', '3', 'ALVENARIA E REVESTIMENTOS', '', 0, 0, []],
    ['item', '3.1', 'Alvenaria de vedação com bloco cerâmico 14 cm', 'm²', 410, 92.15, [0, 0, 35, 40, 25]],
    ['item', '3.2', 'Chapisco em paredes', 'm²', 820, 6.9, [0, 0, 20, 40, 40]],
    ['item', '3.3', 'Reboco/massa única', 'm²', 820, 38.4, [0, 0, 0, 40, 40, 20]],
    ['etapa', '4', 'PINTURA E LIMPEZA', '', 0, 0, []],
    ['item', '4.1', 'Pintura acrílica em paredes, 2 demãos', 'm²', 820, 21.3, [0, 0, 0, 0, 40, 60]],
    ['item', '4.2', 'Limpeza final da obra', 'm²', 320, 4.2, [0, 0, 0, 0, 0, 100]],
  ];
  const itens: Item[] = base.map(([tipo, codigo, descricao, unidade, quantidade, precoUnitario], k) => ({
    id: uid(), contratoId: cid, ordem: k + 1, tipo, codigo, descricao, unidade, quantidade, precoUnitario, fonte: tipo === 'item' ? 'SINAPI' : undefined,
  }));
  await db.itens.bulkAdd(itens);
  await db.cronograma.bulkAdd(itens.filter((i) => i.tipo === 'item').map((i, k) => {
    const p = base.filter((b) => b[0] === 'item')[k][6];
    return { contratoId: cid, itemId: i.id, percentuais: Array.from({ length: 6 }, (_, j) => p[j] ?? 0) };
  }));
  const it = (c: string) => itens.find((i) => i.codigo === c)!.id;
  const fim = (k: number) => { const d = new Date(ini.getFullYear(), ini.getMonth() + k + 1, 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const med = [
    { id: uid(), numero: 1, periodoInicio: dataInicio, periodoFim: fim(0), status: 'aprovada' as const },
    { id: uid(), numero: 2, periodoInicio: addDias(fim(0), 1), periodoFim: fim(1), status: 'em_analise' as const },
  ];
  for (const x of med) await db.medicoes.add({ ...x, contratoId: cid, dataEmissao: addDias(x.periodoFim, 3), reajustePercentual: 0, quantidadesManuais: {} });
  const L = (mi: number, codigo: string, descricao: string, d: Partial<MemoriaLinha>): MemoriaLinha => ({
    id: uid(), contratoId: cid, medicaoId: med[mi].id, itemId: it(codigo), ordem: Math.random(), descricao, ...d,
  });
  await db.memoria.bulkAdd([
    L(0, '1.1', 'Placa conforme modelo do contratante', { n: 1, c: 3, l: 2 }),
    L(0, '1.2', 'Área do bloco de ampliação', { c: 20, l: 16 }),
    L(0, '1.3', 'Paredes internas bloco A', { n: 2, c: 4.5, l: 0.15, h: 2.8 }),
    L(0, '1.3', 'Muro lateral', { formula: '12,4*0,15*2,2' }),
    L(0, '2.1', 'Vala sapatas corridas eixo A', { c: 32, l: 0.6, h: 0.8 }),
    L(1, '1.3', 'Paredes internas bloco B', { formula: '(3,8+4,2)*0,15*2,8' }),
    L(1, '2.1', 'Vala sapatas corridas eixo B e C', { n: 2, c: 16, l: 0.6, h: 0.8 }),
    L(1, '2.2', 'Sapatas S1 a S8', { n: 8, c: 1.2, l: 1.2, h: 0.4 }),
    L(1, '2.2', 'Vigas baldrame', { c: 64, l: 0.2, h: 0.4 }),
    L(1, '2.3', 'Conforme romaneio de armação nº 01', { n: 1, c: 980 }),
  ]);
  await db.diario.add({ id: uid(), contratoId: cid, data: addDias(dataInicio, 2), climaManha: 'Bom', climaTarde: 'Bom', maoDeObra: '1 encarregado, 3 pedreiros, 5 serventes', equipamentos: 'Betoneira 400 L', atividades: 'Instalação da placa de obra e início da locação.', ocorrencias: '' });
}
