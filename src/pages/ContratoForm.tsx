import { useEffect, useState } from 'react';
import { usePerm } from '../lib/acesso';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { db, excluirContrato, flush, uid, type Contrato } from '../lib/db';
import { hojeISO, parseNum, num } from '../lib/format';
import { blobParaDataURL, comprimirImagem } from '../lib/image';

const novo = (): Contrato => ({
  id: uid(), numero: '', objeto: '', contratante: '', contratada: '', dataInicio: hojeISO(), prazoDias: 180,
  mesesCronograma: 6, bdi: 25, retencoes: [], status: 'ativo', criadoEm: new Date().toISOString(),
});

const SUGESTOES = [
  { nome: 'INSS', percentual: 11, base: 50 },
  { nome: 'ISS', percentual: 5, base: 50 },
  { nome: 'IRRF', percentual: 1.2, base: 100 },
  { nome: 'Caução / garantia', percentual: 5, base: 100 },
];

export default function ContratoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<Contrato | null>(id ? null : novo());
  const perm = usePerm();
  const [obras, setObras] = useState<{ id: number; codigo: string | null; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (id) db.contratos.get(id).then((x) => x && setC(x));
  }, [id]);
  useEffect(() => {
    supabase.rpc('medobra_obras').then(({ data }) => setObras((data as typeof obras) ?? []));
  }, []);
  if (!c) return null;

  const set = <K extends keyof Contrato>(k: K, v: Contrato[K]) => setC({ ...c, [k]: v });
  const txt = (k: keyof Contrato, rot: string, props: Record<string, unknown> = {}) => (
    <label className="campo">{rot}
      <input value={(c[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </label>
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (id) await db.contratos.update(c!.id, c!);
      else await db.contratos.add(c!);
      await flush();
      nav(`/contratos/${c!.id}`);
    } catch {
      setSalvando(false);
    }
  }

  async function logo(f?: File) {
    if (!f) return;
    set('logo', await blobParaDataURL(await comprimirImagem(f, 400, 0.9)));
  }

  return (
    <form onSubmit={salvar}>
      <h1>{id ? 'Dados do contrato' : 'Novo contrato'}</h1>
      <fieldset className="leitura" disabled={!perm.admin}>
      {!perm.admin && <div className="aviso pequeno">Somente administradores alteram os dados do contrato.</div>}
      <div className="card">
        <h3>Identificação</h3>
        <div className="grid g4">
          {txt('numero', 'Nº do contrato *', { required: true })}
          {txt('processo', 'Processo / licitação')}
          <label className="campo">Status
            <select value={c.status} onChange={(e) => set('status', e.target.value as Contrato['status'])}>
              <option value="ativo">Ativo</option><option value="paralisado">Paralisado</option><option value="concluido">Concluído</option>
            </select>
          </label>
          {txt('local', 'Local da obra')}
          <label className="campo">Obra (Central de Acessos)
            <select value={c.obraId ?? ''} onChange={(e) => set('obraId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— sem obra (visível só a quem vê todas as obras) —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} · ` : ''}{o.nome}</option>)}
              {c.obraId && !obras.some((o) => o.id === c.obraId) && <option value={c.obraId}>obra nº {c.obraId}</option>}
            </select>
          </label>
        </div>
        <label className="campo" style={{ marginTop: '1rem' }}>Objeto *
          <textarea rows={2} required value={c.objeto} onChange={(e) => set('objeto', e.target.value)} />
        </label>
      </div>

      <div className="card">
        <h3>Partes</h3>
        <div className="grid g4">
          {txt('contratante', 'Contratante *', { required: true })}
          {txt('cnpjContratante', 'CNPJ contratante')}
          {txt('contratada', 'Contratada *', { required: true })}
          {txt('cnpjContratada', 'CNPJ contratada')}
          {txt('fiscal', 'Fiscal do contrato')}
          {txt('responsavelTecnico', 'Responsável técnico (contratada)')}
        </div>
        <div className="linha" style={{ marginTop: '1rem' }}>
          <label className="campo">Logomarca (cabeçalho dos relatórios)
            <input type="file" accept="image/*" onChange={(e) => logo(e.target.files?.[0])} />
          </label>
          {c.logo && <><img src={c.logo} style={{ maxHeight: 50 }} alt="logo" /><button type="button" className="mini" onClick={() => set('logo', undefined)}>remover</button></>}
        </div>
      </div>

      <div className="card">
        <h3>Prazos e valores</h3>
        <div className="grid g4">
          <label className="campo">Data de assinatura<input type="date" value={c.dataAssinatura ?? ''} onChange={(e) => set('dataAssinatura', e.target.value)} /></label>
          <label className="campo">Início (ordem de serviço) *<input type="date" required value={c.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} /></label>
          <label className="campo">Prazo de execução (dias) *
            <input type="number" min={1} required value={c.prazoDias} onChange={(e) => {
              const p = Number(e.target.value);
              setC({ ...c, prazoDias: p, mesesCronograma: id ? c.mesesCronograma : Math.max(1, Math.ceil(p / 30)) });
            }} />
          </label>
          <label className="campo">Meses no cronograma<input type="number" min={1} max={120} value={c.mesesCronograma} onChange={(e) => set('mesesCronograma', Number(e.target.value))} /></label>
          <label className="campo">BDI (%)<input value={num(c.bdi)} onChange={(e) => set('bdi', parseNum(e.target.value))} /></label>
        </div>
        <p className="muted pequeno">O valor do contrato é calculado a partir da planilha orçamentária (preços unitários já com BDI).</p>
      </div>

      <div className="card">
        <h3>Retenções aplicadas no boletim</h3>
        <p className="muted pequeno">Cada retenção incide sobre um percentual do valor bruto da medição (ex.: INSS 11% sobre 50% referente à mão de obra). Confira as alíquotas do seu contrato e município.</p>
        {c.retencoes.map((r, i) => (
          <div className="linha" key={i} style={{ marginBottom: '.4rem' }}>
            <input placeholder="Nome" value={r.nome} onChange={(e) => set('retencoes', c.retencoes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
            <input style={{ width: 90 }} value={num(r.percentual)} onChange={(e) => set('retencoes', c.retencoes.map((x, j) => (j === i ? { ...x, percentual: parseNum(e.target.value) } : x)))} />
            <span>% sobre</span>
            <input style={{ width: 90 }} value={num(r.base)} onChange={(e) => set('retencoes', c.retencoes.map((x, j) => (j === i ? { ...x, base: parseNum(e.target.value) } : x)))} />
            <span>% do bruto</span>
            <button type="button" className="mini perigo" onClick={() => set('retencoes', c.retencoes.filter((_, j) => j !== i))}>remover</button>
          </div>
        ))}
        <div className="linha">
          <button type="button" onClick={() => set('retencoes', [...c.retencoes, { nome: '', percentual: 0, base: 100 }])}>+ Retenção</button>
          {SUGESTOES.filter((s) => !c.retencoes.some((r) => r.nome === s.nome)).map((s) => (
            <button type="button" className="mini" key={s.nome} onClick={() => set('retencoes', [...c.retencoes, s])}>+ {s.nome}</button>
          ))}
        </div>
      </div>

      </fieldset>
      <div className="linha">
        {perm.admin && <button type="submit" className="pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar contrato'}</button>}
        <button type="button" onClick={() => nav(-1)}>Cancelar</button>
        <span className="espaco" />
        {id && perm.admin && (
          <button type="button" className="perigo" onClick={async () => {
            if (confirm('Excluir o contrato e TODOS os dados (planilha, medições, fotos)? Esta ação não pode ser desfeita.')) {
              await excluirContrato(c.id);
              nav('/');
            }
          }}>Excluir contrato</button>
        )}
      </div>
    </form>
  );
}
