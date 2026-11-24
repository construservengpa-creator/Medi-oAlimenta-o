import { useState } from 'react';
import { db } from '../lib/db';
import { baixarArquivo } from '../lib/csv';
import { hojeISO } from '../lib/format';

export default function Backup() {
  const [msg, setMsg] = useState('');

  async function exportar() {
    const dados = {
      versao: 2, geradoEm: new Date().toISOString(),
      contratos: await db.contratos.toArray(), itens: await db.itens.toArray(), cronograma: await db.cronograma.toArray(),
      medicoes: await db.medicoes.toArray(), memoria: await db.memoria.toArray(), aditivos: await db.aditivos.toArray(),
      diario: await db.diario.toArray(), fotos: await db.fotos.toArray(),
    };
    baixarArquivo(`medicao-obras-${hojeISO()}.json`, new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
    setMsg(`Exportados ${dados.contratos.length} contrato(s).`);
  }

  return (
    <>
      <h1>Exportar dados</h1>
      <div className="card">
        <p>Os dados ficam no banco do Painel de Suprimentos (Supabase), com cópia de segurança do próprio servidor. Aqui você baixa um arquivo JSON com os contratos que você tem acesso — útil para análises externas ou arquivo.</p>
        <p className="muted pequeno">As fotos ficam no armazenamento do servidor; o arquivo traz apenas a referência delas.</p>
        <button className="pri" onClick={exportar}>Baixar dados (JSON)</button>
        {msg && <div className="aviso ok">{msg}</div>}
      </div>
    </>
  );
}
