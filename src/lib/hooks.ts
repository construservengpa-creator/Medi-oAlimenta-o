import { useEffect, useState, useSyncExternalStore } from 'react';
import { db, store, urlFoto } from './db';

/** Executa a consulta (sobre o cache) e repete a cada alteração dos dados. */
export function useLiveQuery<T>(fn: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const versao = useSyncExternalStore(store.assinar, () => store.versao);
  const [res, setRes] = useState<T>();
  useEffect(() => {
    let vivo = true;
    Promise.resolve(fn()).then((r) => { if (vivo) setRes(() => r); });
    return () => { vivo = false; };
  }, [versao, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return res;
}

/** Carrega todos os dados de um contrato e reage a qualquer alteração. */
export function useContrato(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const contrato = await db.contratos.get(id);
    if (!contrato) return null;
    const [itens, aditivos, medicoes, memoria, cronograma] = await Promise.all([
      db.itens.where('contratoId').equals(id).sortBy('ordem'),
      db.aditivos.where('contratoId').equals(id).toArray(),
      db.medicoes.where('contratoId').equals(id).sortBy('numero'),
      db.memoria.where('contratoId').equals(id).toArray(),
      db.cronograma.where('contratoId').equals(id).toArray(),
    ]);
    return { contrato, itens, aditivos, medicoes, memoria, cronograma };
  }, [id]);
}

export type DadosContrato = NonNullable<Awaited<ReturnType<typeof carregarTipo>>>;
// apenas para inferência de tipo
async function carregarTipo() {
  const contrato = (await db.contratos.get(''))!;
  return {
    contrato,
    itens: await db.itens.toArray(),
    aditivos: await db.aditivos.toArray(),
    medicoes: await db.medicoes.toArray(),
    memoria: await db.memoria.toArray(),
    cronograma: await db.cronograma.toArray(),
  };
}

/** URL assinada (temporária) de uma foto do armazenamento. */
export function useFotoURL(caminho: string | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let vivo = true;
    if (caminho) urlFoto(caminho).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
  }, [caminho]);
  return url;
}
