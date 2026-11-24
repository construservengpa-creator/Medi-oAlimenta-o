import { useState } from 'react';
import { db } from '../lib/db';
import { blobParaDataURL, dataURLParaBlob } from '../lib/image';
import { baixarArquivo } from '../lib/csv';
import { hojeISO } from '../lib/format';

export default function Backup() {
  const [msg, setMsg] = useState('');

  async function exportar() {
    setMsg('Gerando backup…');
    const fotos = await Promise.all((await db.fotos.toArray()).map(async (f) => ({ ...f, blob: await blobParaDataURL(f.blob) })));
    const dados = {
      versao: 1, geradoEm: new Date().toISOString(),
      contratos: await db.contratos.toArray(), itens: await db.itens.toArray(), cronograma: await db.cronograma.toArray(),
      medicoes: await db.medicoes.toArray(), memoria: await db.memoria.toArray(), aditivos: await db.aditivos.toArray(),
      diario: await db.diario.toArray(), fotos,
    };
    baixarArquivo(`backup-medicoes-${hojeISO()}.json`, new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    setMsg('Backup gerado.');
  }

  async function importar(f?: File) {
    if (!f) return;
    if (!confirm('Restaurar o backup SUBSTITUI todos os dados atuais deste navegador. Continuar?')) return;
    try {
      setMsg('Restaurando…');
      const d = JSON.parse(await f.text());
      const fotos = await Promise.all((d.fotos ?? []).map(async (x: { blob: string }) => ({ ...x, blob: await dataURLParaBlob(x.blob) })));
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
        await db.contratos.bulkAdd(d.contratos ?? []);
        await db.itens.bulkAdd(d.itens ?? []);
        await db.cronograma.bulkAdd(d.cronograma ?? []);
        await db.medicoes.bulkAdd(d.medicoes ?? []);
        await db.memoria.bulkAdd(d.memoria ?? []);
        await db.aditivos.bulkAdd(d.aditivos ?? []);
        await db.diario.bulkAdd(d.diario ?? []);
        await db.fotos.bulkAdd(fotos);
      });
      setMsg(`Backup restaurado: ${(d.contratos ?? []).length} contrato(s).`);
    } catch (e) {
      setMsg(`Erro ao restaurar: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <h1>Backup e restauração</h1>
      <div className="card">
        <p>Os dados ficam armazenados <b>neste navegador</b> (funciona offline, inclusive no canteiro). Faça backups periódicos — limpar os dados do navegador apaga as informações.</p>
        <div className="linha">
          <button className="pri" onClick={exportar}>Baixar backup completo (com fotos)</button>
          <label className="botao">Restaurar backup<input type="file" accept="application/json" hidden onChange={(e) => importar(e.target.files?.[0])} /></label>
        </div>
        {msg && <div className="aviso ok">{msg}</div>}
        <p className="muted pequeno">O arquivo de backup também serve para transferir os dados para outro computador ou enviar ao escritório.</p>
      </div>
    </>
  );
}
