import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './db';

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

export type DadosContrato = NonNullable<ReturnType<typeof useContrato>>;

export function useBlobURL(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
