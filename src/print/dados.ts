import { useEffect } from 'react';
import { db } from '../lib/db';
import { useContrato, useLiveQuery } from '../lib/hooks';

export function useMedicaoPrint(mid: string | undefined) {
  const contratoId = useLiveQuery(async () => (mid ? (await db.medicoes.get(mid))?.contratoId ?? null : null), [mid]);
  const d = useContrato(contratoId ?? undefined);
  const medicao = d?.medicoes.find((m) => m.id === mid);
  return d && medicao ? { ...d, medicao } : undefined;
}

/** Define orientação da página para impressão. */
export function usePagina(orientacao: 'portrait' | 'landscape', titulo: string) {
  useEffect(() => {
    const st = document.createElement('style');
    st.textContent = `@page { size: A4 ${orientacao}; margin: 10mm; }`;
    document.head.appendChild(st);
    const t = document.title;
    document.title = titulo;
    return () => { st.remove(); document.title = t; };
  }, [orientacao, titulo]);
}
