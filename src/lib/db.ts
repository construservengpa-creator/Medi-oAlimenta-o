/**
 * Camada de dados sobre o Supabase.
 *
 * Todos os registros visíveis ao usuário (RLS) ficam num cache em memória; as telas leem do cache
 * (instantâneo) e as gravações atualizam o cache na hora e são enviadas ao servidor numa fila
 * ordenada. Edições de campo (update) são agrupadas por ~0,6 s para não gerar uma requisição por tecla.
 * A API imita o pouco que as telas usavam do Dexie (get, where().equals(), add, update…).
 */
import { supabase, BUCKET_FOTOS } from './supabase';

export interface Retencao {
  nome: string;
  percentual: number;
  base: number;
}

export type StatusContrato = 'ativo' | 'paralisado' | 'concluido';

export interface Contrato {
  id: string;
  obraId?: number | null;
  numero: string;
  processo?: string;
  objeto: string;
  contratante: string;
  cnpjContratante?: string;
  contratada: string;
  cnpjContratada?: string;
  local?: string;
  dataAssinatura?: string;
  dataInicio: string;
  prazoDias: number;
  mesesCronograma: number;
  bdi: number;
  fiscal?: string;
  responsavelTecnico?: string;
  retencoes: Retencao[];
  status: StatusContrato;
  logo?: string;
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
  fonte?: string;
  aditivoId?: string;
}

export interface CronogramaLinha {
  contratoId: string;
  itemId: string;
  percentuais: number[];
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
  enviadoPorNome?: string | null;
  enviadoEm?: string | null;
  aprovadoPorNome?: string | null;
  aprovadoEm?: string | null;
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
  caminho: string;
  legenda: string;
  local?: string;
  data: string;
  ordem: number;
}

export interface AlteracaoItem {
  itemId: string;
  delta: number;
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

/* ------------------------------------------------------------------ */

type Linha = Record<string, unknown>;
type Chave = string | (string | number)[];

const TABELAS = {
  contratos: { nome: 'medobra_contratos', chave: ['id'] },
  aditivos: { nome: 'medobra_aditivos', chave: ['id'] },
  itens: { nome: 'medobra_itens', chave: ['id'] },
  cronograma: { nome: 'medobra_cronograma', chave: ['contratoId', 'itemId'] },
  medicoes: { nome: 'medobra_medicoes', chave: ['id'] },
  memoria: { nome: 'medobra_memoria', chave: ['id'] },
  fotos: { nome: 'medobra_fotos', chave: ['id'] },
  diario: { nome: 'medobra_diario', chave: ['id'] },
} as const;
type NomeTabela = keyof typeof TABELAS;
// ordem de carga/gravação respeitando as chaves estrangeiras
const ORDEM: NomeTabela[] = ['contratos', 'aditivos', 'itens', 'cronograma', 'medicoes', 'memoria', 'fotos', 'diario'];

const paraSnake = (o: Linha) => {
  const r: Linha = {};
  for (const [k, v] of Object.entries(o)) r[k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())] = v === undefined ? null : v;
  return r;
};
const col = (campo: string) => campo.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const paraCamel = (o: Linha) => {
  const r: Linha = {};
  for (const [k, v] of Object.entries(o)) r[k.replace(/_([a-z])/g, (_, m) => m.toUpperCase())] = v === null ? undefined : v;
  return r;
};

/* ---------- estado global ---------- */

const cache = Object.fromEntries(ORDEM.map((t) => [t, new Map<string, Linha>()])) as Record<NomeTabela, Map<string, Linha>>;
const ouvintes = new Set<() => void>();
let versao = 0;
let carregadoEm = 0;

export const store = {
  get versao() { return versao; },
  get carregadoEm() { return carregadoEm; },
  assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
};
function emitir() {
  versao++;
  for (const f of ouvintes) f();
}

/* ---------- avisos de erro ---------- */

type Aviso = (msg: string) => void;
let aviso: Aviso = (m) => alert(m);
export function definirAviso(f: Aviso) { aviso = f; }

function traduzirErro(e: { message?: string; code?: string }): string {
  const m = e.message ?? String(e);
  if (/row-level security|permission denied|violates row-level/i.test(m)) return 'Você não tem permissão para esta alteração (verifique seu perfil na Central de Acessos).';
  if (/duplicate key.*numero/i.test(m)) return 'Já existe um registro com este número.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. A alteração não foi salva.';
  return m;
}

/* ---------- fila de gravação ---------- */

let fila: Promise<unknown> = Promise.resolve();
let pendentes = 0;
const listenersPend = new Set<(n: number) => void>();
export function assinarPendentes(f: (n: number) => void) { listenersPend.add(f); return () => { listenersPend.delete(f); }; }
function setPend(d: number) { pendentes += d; for (const f of listenersPend) f(pendentes); }

function enfileirar<T>(op: () => PromiseLike<{ error: unknown } & T>): Promise<void> {
  setPend(1);
  const p = fila.then(async () => {
    const r = await op();
    if (r.error) throw r.error;
  });
  fila = p.catch(async (e) => {
    aviso(traduzirErro(e as { message?: string }));
    await recarregar(); // volta o cache para o que está no servidor
  }).finally(() => setPend(-1));
  return p;
}

// updates agrupados por registro
const agrupados = new Map<string, { tabela: NomeTabela; chave: Chave; patch: Linha; timer: ReturnType<typeof setTimeout> }>();
function chaveTexto(t: NomeTabela, k: Chave) { return `${t}:${Array.isArray(k) ? k.join('|') : k}`; }
function disparar(id: string) {
  const g = agrupados.get(id);
  if (!g) return;
  clearTimeout(g.timer);
  agrupados.delete(id);
  setPend(-1);
  const cfg = TABELAS[g.tabela];
  const vals = Array.isArray(g.chave) ? g.chave : g.chave.split('|');
  enfileirar(() => {
    let q = supabase.from(cfg.nome).update(paraSnake(g.patch));
    cfg.chave.forEach((c, i) => { q = q.eq(col(c), vals[i]); });
    return q;
  }).catch(() => {});
}

/** Envia imediatamente as edições pendentes e espera a fila esvaziar. */
export async function flush() {
  for (const id of [...agrupados.keys()]) disparar(id);
  await fila;
}

/* ---------- carga ---------- */

async function buscarTudo(nome: string): Promise<Linha[]> {
  const out: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(nome).select('*').range(de, de + 999);
    if (error) throw error;
    out.push(...(data as Linha[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function recarregar() {
  const dados = await Promise.all(ORDEM.map((t) => buscarTudo(TABELAS[t].nome)));
  ORDEM.forEach((t, i) => {
    const m = cache[t];
    m.clear();
    for (const r of dados[i]) {
      const c = paraCamel(r);
      m.set(chaveDe(t, c), c);
    }
  });
  carregadoEm = Date.now();
  emitir();
}

export function limparCache() {
  for (const t of ORDEM) cache[t].clear();
  carregadoEm = 0;
  emitir();
}

function chaveDe(t: NomeTabela, row: Linha): string {
  return TABELAS[t].chave.map((c) => String(row[c])).join('|');
}
function chaveArg(k: Chave): string {
  return Array.isArray(k) ? k.map(String).join('|') : k;
}

/* ---------- API estilo Dexie ---------- */

class Colecao<T> {
  constructor(private linhas: () => T[], private inverso = false, private onDelete?: () => Promise<void>) {}
  async toArray() { const a = this.linhas(); return this.inverso ? a.reverse() : a; }
  async sortBy(campo: keyof T & string) {
    const a = [...this.linhas()].sort((x, y) => {
      const a1 = x[campo] as unknown as number | string, b1 = y[campo] as unknown as number | string;
      return a1 < b1 ? -1 : a1 > b1 ? 1 : 0;
    });
    return this.inverso ? a.reverse() : a;
  }
  reverse() { return new Colecao<T>(this.linhas, !this.inverso, this.onDelete); }
  async delete() { await this.onDelete?.(); }
}

class Tabela<T extends object> {
  constructor(private t: NomeTabela) {}
  private get m() { return cache[this.t] as unknown as Map<string, T>; }
  private get cfg() { return TABELAS[this.t]; }

  async get(k: Chave): Promise<T | undefined> { return this.m.get(chaveArg(k)); }
  async toArray(): Promise<T[]> { return [...this.m.values()]; }
  where(campo: keyof T & string) {
    return {
      equals: (v: unknown) => new Colecao<T>(
        () => [...this.m.values()].filter((r) => (r as Linha)[campo] === v),
        false,
        async () => {
          const alvo = [...this.m.entries()].filter(([, r]) => (r as Linha)[campo] === v);
          alvo.forEach(([k]) => this.m.delete(k));
          emitir();
          await enfileirar(() => supabase.from(this.cfg.nome).delete().eq(col(campo), v as string));
        },
      ),
    };
  }

  async add(row: T): Promise<void> { return this.bulkAdd([row]); }
  async bulkAdd(rows: T[]): Promise<void> {
    if (!rows.length) return;
    for (const r of rows) this.m.set(chaveDe(this.t, r as Linha), { ...r });
    emitir();
    for (let i = 0; i < rows.length; i += 500) {
      const lote = rows.slice(i, i + 500).map((r) => paraSnake(r as Linha));
      await enfileirar(() => supabase.from(this.cfg.nome).insert(lote));
    }
  }
  async put(row: T): Promise<void> {
    const k = chaveDe(this.t, row as Linha);
    this.m.set(k, { ...row });
    emitir();
    // upserts repetidos (ex.: cronograma) também são agrupados
    const id = chaveTexto(this.t, k) + ':put';
    const ant = agrupados.get(id);
    if (ant) { clearTimeout(ant.timer); agrupados.delete(id); setPend(-1); }
    setPend(1);
    const timer = setTimeout(() => {
      agrupados.delete(id);
      setPend(-1);
      const atual = this.m.get(k);
      if (atual) enfileirar(() => supabase.from(this.cfg.nome).upsert(paraSnake(atual as Linha))).catch(() => {});
    }, 600);
    agrupados.set(id, { tabela: this.t, chave: k, patch: {}, timer });
  }
  async update(k: Chave, patch: Partial<T>): Promise<void> {
    const kk = chaveArg(k);
    const atual = this.m.get(kk);
    if (!atual) return;
    this.m.set(kk, { ...atual, ...patch });
    emitir();
    const id = chaveTexto(this.t, k);
    const g = agrupados.get(id);
    if (g) {
      clearTimeout(g.timer);
      Object.assign(g.patch, patch);
      g.timer = setTimeout(() => disparar(id), 600);
    } else {
      setPend(1);
      agrupados.set(id, { tabela: this.t, chave: k, patch: { ...patch } as Linha, timer: setTimeout(() => disparar(id), 600) });
    }
  }
  async delete(k: Chave): Promise<void> {
    const kk = chaveArg(k);
    // descarta edições pendentes do registro excluído
    for (const id of [chaveTexto(this.t, k), chaveTexto(this.t, kk) + ':put']) {
      const g = agrupados.get(id);
      if (g) { clearTimeout(g.timer); agrupados.delete(id); setPend(-1); }
    }
    if (!this.m.delete(kk)) return;
    emitir();
    const vals = Array.isArray(k) ? k : [k];
    await enfileirar(() => {
      let q = supabase.from(this.cfg.nome).delete();
      this.cfg.chave.forEach((c, i) => { q = q.eq(col(c), vals[i]); });
      return q;
    });
  }
  /** Remove do cache (o servidor já apagou em cascata). */
  descartarLocal(f: (r: T) => boolean) {
    for (const [k, r] of [...this.m.entries()]) if (f(r)) this.m.delete(k);
  }
}

export const db = {
  contratos: new Tabela<Contrato>('contratos'),
  aditivos: new Tabela<Aditivo>('aditivos'),
  itens: new Tabela<Item>('itens'),
  cronograma: new Tabela<CronogramaLinha>('cronograma'),
  medicoes: new Tabela<Medicao>('medicoes'),
  memoria: new Tabela<MemoriaLinha>('memoria'),
  fotos: new Tabela<Foto>('fotos'),
  diario: new Tabela<Diario>('diario'),
  /** Mantido por compatibilidade: as operações já são enviadas em ordem. */
  async transaction(_modo: string, _tabelas: unknown, fn: () => Promise<void>) { await fn(); },
};

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function removerArquivos(caminhos: string[]) {
  for (let i = 0; i < caminhos.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET_FOTOS).remove(caminhos.slice(i, i + 100));
    if (error) console.warn('Falha ao remover fotos do armazenamento', error);
  }
}

export async function excluirContrato(id: string) {
  await flush();
  const fotos = (await db.fotos.where('contratoId').equals(id).toArray()).map((f) => f.caminho);
  await db.contratos.delete(id); // o banco apaga o restante em cascata
  for (const t of [db.itens, db.cronograma, db.medicoes, db.memoria, db.fotos, db.aditivos, db.diario] as Tabela<{ contratoId: string }>[])
    t.descartarLocal((r) => r.contratoId === id);
  emitir();
  await removerArquivos(fotos);
}

export async function excluirMedicao(id: string) {
  await flush();
  const fotos = (await db.fotos.where('medicaoId').equals(id).toArray()).map((f) => f.caminho);
  await db.medicoes.delete(id);
  db.memoria.descartarLocal((r) => r.medicaoId === id);
  db.fotos.descartarLocal((r) => r.medicaoId === id);
  emitir();
  await removerArquivos(fotos);
}

/* ---------- fotos ---------- */

export async function enviarFoto(f: Omit<Foto, 'caminho'>, blob: Blob) {
  const caminho = `${f.contratoId}/${f.medicaoId}/${f.id}.jpg`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(traduzirErro(error));
  await db.fotos.add({ ...f, caminho });
}

export async function excluirFoto(f: Foto) {
  await db.fotos.delete(f.id);
  await removerArquivos([f.caminho]);
}

const urls = new Map<string, { url: string; expira: number }>();
export async function urlFoto(caminho: string): Promise<string | undefined> {
  const c = urls.get(caminho);
  if (c && c.expira > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(caminho, 3600);
  if (error || !data) return undefined;
  urls.set(caminho, { url: data.signedUrl, expira: Date.now() + 3500_000 });
  return data.signedUrl;
}
