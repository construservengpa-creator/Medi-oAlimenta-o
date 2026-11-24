import { useParams } from 'react-router-dom';
import { useMedicaoPrint, usePagina } from './dados';
import { Assinaturas, BarraImpressao, Cabecalho } from './Cabecalho';
import { db, type Foto, type Item } from '../lib/db';
import { useFotoURL, useLiveQuery } from '../lib/hooks';
import { fmtDate } from '../lib/format';

export default function FotosPrint() {
  const { mid } = useParams();
  const d = useMedicaoPrint(mid);
  const fotos = useLiveQuery(() => (mid ? db.fotos.where('medicaoId').equals(mid).sortBy('ordem') : []), [mid]);
  usePagina('portrait', d ? `Relatório fotográfico ${d.medicao.numero} - Contrato ${d.contrato.numero}` : 'Relatório fotográfico');
  if (!d || !fotos) return null;

  // agrupa por item na ordem da planilha; fotos gerais por último
  const itensOrd = [...d.itens].filter((i) => i.tipo === 'item').sort((a, b) => a.ordem - b.ordem);
  const grupos: { item?: Item; fotos: Foto[] }[] = itensOrd.map((item) => ({ item, fotos: fotos.filter((f) => f.itemId === item.id) })).filter((g) => g.fotos.length);
  const gerais = fotos.filter((f) => !f.itemId || !itensOrd.some((i) => i.id === f.itemId));
  if (gerais.length) grupos.push({ fotos: gerais });
  let n = 0;

  return (
    <>
      <BarraImpressao />
      <div className="folha retrato">
        <Cabecalho titulo={`RELATÓRIO FOTOGRÁFICO — MEDIÇÃO Nº ${String(d.medicao.numero).padStart(2, '0')}`} contrato={d.contrato} aditivos={d.aditivos} medicao={d.medicao} />
        {fotos.length === 0 && <p>Nenhuma foto registrada nesta medição.</p>}
        {grupos.map((g, k) => (
          <div key={k}>
            <h2>{g.item ? `${g.item.codigo} — ${g.item.descricao}` : 'Registros gerais'}</h2>
            <div className="fotos-p">
              {g.fotos.map((f) => <FotoP key={f.id} f={f} n={++n} />)}
            </div>
          </div>
        ))}
        <Assinaturas contrato={d.contrato} />
      </div>
    </>
  );
}

function FotoP({ f, n }: { f: Foto; n: number }) {
  const url = useFotoURL(f.caminho);
  return (
    <div className="foto-p">
      {url && <img src={url} alt="" />}
      <div><b>Foto {n}</b> — {f.legenda || 'sem legenda'}<br /><span style={{ color: '#555' }}>{[f.local, fmtDate(f.data)].filter(Boolean).join(' · ')}</span></div>
    </div>
  );
}
