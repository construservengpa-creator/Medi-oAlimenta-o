import Dexie, { type Table } from 'dexie';

export interface Retencao {
  nome: string;
  percentual: number; // %
  base: number; // % do valor bruto sobre o qual incide (ex.: INSS sobre 50% = mão de obra)
}

export type StatusContrato = 'ativo' | 'paralisado' | 'concluido';

export interface Contrato {
  id: string;
  numero: string;
  processo?: string;
  objeto: string;
  contratante: string;
  cnpjContratante?: string;
  contratada: string;
  cnpjContratada?: string;
  local?: string;
  dataAssinatura?: string;
  dataInicio: string; // ISO yyyy-mm-dd (ordem de serviço)
  prazoDias: number;
  mesesCronograma: number;
  bdi: number;
  fiscal?: string;
  responsavelTecnico?: string;
  retencoes: Retencao[];
  status: StatusContrato;
  logo?: string; // dataURL
  criadoEm: string;
}

export interface Item {
  id: string;
  contratoId: string;
  ordem: number;
  tipo: 'etapa' | 'item';
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  fonte?: string; // SINAPI, SICRO, composição própria...
  aditivoId?: string; // item incluído por aditivo
}

export interface CronogramaLinha {
  contratoId: string;
  itemId: string;
  percentuais: number[]; // % por mês
}

export type StatusMedicao = 'rascunho' | 'em_analise' | 'aprovada';

export interface Medicao {
  id: string;
  contratoId: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  dataEmissao: string;
  status: StatusMedicao;
  reajustePercentual: number;
  observacoes?: string;
  quantidadesManuais: Record<string, number>;
}

export interface MemoriaLinha {
  id: string;
  contratoId: string;
  medicaoId: string;
  itemId: string;
  ordem: number;
  descricao: string;
  n?: number | null;
  c?: number | null;
  l?: number | null;
  h?: number | null;
  formula?: string;
}

export interface Foto {
  id: string;
  contratoId: string;
  medicaoId: string;
  itemId?: string;
  blob: Blob;
  legenda: string;
  local?: string;
  data: string;
  ordem: number;
}

export interface AlteracaoItem {
  itemId: string;
  delta: number; // + acréscimo / − supressão de quantidade
}

export interface Aditivo {
  id: string;
  contratoId: string;
  numero: string;
  data: string;
  dias: number;
  descricao: string;
  alteracoes: AlteracaoItem[];
}

export interface Diario {
  id: string;
  contratoId: string;
  data: string;
  climaManha: string;
  climaTarde: string;
  maoDeObra: string;
  equipamentos: string;
  atividades: string;
  ocorrencias: string;
}

class MedicaoDB extends Dexie {
  contratos!: Table<Contrato, string>;
  itens!: Table<Item, string>;
  cronograma!: Table<CronogramaLinha, [string, string]>;
  medicoes!: Table<Medicao, string>;
  memoria!: Table<MemoriaLinha, string>;
  fotos!: Table<Foto, string>;
  aditivos!: Table<Aditivo, string>;
  diario!: Table<Diario, string>;

  constructor() {
    super('sistema-medicao');
    this.version(1).stores({
      contratos: 'id, numero',
      itens: 'id, contratoId, ordem',
      cronograma: '[contratoId+itemId], contratoId',
      medicoes: 'id, contratoId, numero',
      memoria: 'id, contratoId, medicaoId, itemId',
      fotos: 'id, contratoId, medicaoId, itemId',
      aditivos: 'id, contratoId',
      diario: 'id, contratoId, data',
    });
  }
}

export const db = new MedicaoDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function excluirContrato(id: string) {
  await db.transaction('rw', [db.contratos, db.itens, db.cronograma, db.medicoes, db.memoria, db.fotos, db.aditivos, db.diario], async () => {
    await db.itens.where('contratoId').equals(id).delete();
    await db.cronograma.where('contratoId').equals(id).delete();
    await db.medicoes.where('contratoId').equals(id).delete();
    await db.memoria.where('contratoId').equals(id).delete();
    await db.fotos.where('contratoId').equals(id).delete();
    await db.aditivos.where('contratoId').equals(id).delete();
    await db.diario.where('contratoId').equals(id).delete();
    await db.contratos.delete(id);
  });
}

export async function excluirMedicao(id: string) {
  await db.transaction('rw', [db.medicoes, db.memoria, db.fotos], async () => {
    await db.memoria.where('medicaoId').equals(id).delete();
    await db.fotos.where('medicaoId').equals(id).delete();
    await db.medicoes.delete(id);
  });
}
