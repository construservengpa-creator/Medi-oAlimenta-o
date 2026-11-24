import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { APP_ID, supabase } from './supabase';
import { definirAviso, flush, limparCache, recarregar, store } from './db';

export interface Acesso {
  ativo: boolean;
  perfil?: string;
  permissoes: string[];
  todasObras: boolean;
  obras: { id: number; codigo?: string; nome: string }[];
  cadastrado?: boolean;
}

export interface Permissoes {
  admin: boolean;
  lancar: boolean;
  aprovar: boolean;
  nome: string;
  email: string;
  perfil: string;
  sair: () => Promise<void>;
}

const Ctx = createContext<Permissoes | null>(null);
export function usePerm(): Permissoes {
  const p = useContext(Ctx);
  if (!p) throw new Error('usePerm fora do provedor');
  return p;
}

type Estado =
  | { fase: 'iniciando' }
  | { fase: 'login' }
  | { fase: 'sem-acesso'; email: string; motivo: string }
  | { fase: 'carregando' }
  | { fase: 'erro'; msg: string }
  | { fase: 'pronto'; perm: Permissoes };

export function PortaoAcesso({ children, Login, Aviso }: {
  children: ReactNode;
  Login: () => JSX.Element;
  Aviso: (p: { titulo: string; texto: string; sair?: () => void }) => JSX.Element;
}) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [estado, setEstado] = useState<Estado>({ fase: 'iniciando' });
  const [toast, setToast] = useState<string>();

  useEffect(() => {
    definirAviso((m) => setToast(m));
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uidAtual = sessao === undefined ? '?' : sessao?.user.id ?? '-';
  useEffect(() => {
    if (sessao === undefined) return;
    if (!sessao) { limparCache(); setEstado({ fase: 'login' }); return; }
    let vivo = true;
    const sair = async () => { await flush().catch(() => {}); await supabase.auth.signOut(); };
    (async () => {
      setEstado({ fase: 'carregando' });
      const { data, error } = await supabase.rpc('acesso_meu', { p_app: APP_ID });
      if (!vivo) return;
      if (error) return setEstado({ fase: 'erro', msg: error.message });
      const a = data as Acesso & { todas_obras?: boolean };
      const email = sessao.user.email ?? '';
      if (!a?.ativo) {
        return setEstado({
          fase: 'sem-acesso', email,
          motivo: a?.cadastrado === false
            ? 'Seu usuário ainda não foi liberado para a aplicação "Medição de Obras". Peça ao administrador da Central de Acessos.'
            : 'Seu acesso à aplicação "Medição de Obras" está inativo ou vencido. Fale com o administrador da Central de Acessos.',
        });
      }
      try {
        await recarregar();
      } catch (e) {
        return setEstado({ fase: 'erro', msg: (e as Error).message });
      }
      const p = a.permissoes ?? [];
      const admin = p.includes('medobra.admin');
      setEstado({
        fase: 'pronto',
        perm: {
          admin, lancar: admin || p.includes('medobra.lancar'), aprovar: admin || p.includes('medobra.aprovar'),
          nome: (sessao.user.user_metadata?.nome as string) || email, email, perfil: a.perfil ?? '', sair,
        },
      });
    })();
    return () => { vivo = false; };
  }, [uidAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  // ao voltar para a aba depois de um tempo, busca o que outros usuários alteraram
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === 'visible' && estado.fase === 'pronto' && Date.now() - store.carregadoEm > 60_000)
        flush().then(recarregar).catch(() => {});
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [estado.fase]);

  const sairSimples = () => supabase.auth.signOut();
  let corpo: ReactNode;
  if (estado.fase === 'iniciando' || estado.fase === 'carregando') corpo = <div className="vazio">Carregando…</div>;
  else if (estado.fase === 'login') corpo = <Login />;
  else if (estado.fase === 'sem-acesso') corpo = <Aviso titulo={`Sem acesso (${estado.email})`} texto={estado.motivo} sair={sairSimples} />;
  else if (estado.fase === 'erro') corpo = <Aviso titulo="Erro ao carregar" texto={estado.msg} sair={sairSimples} />;
  else corpo = <Ctx.Provider value={estado.perm}>{children}</Ctx.Provider>;

  return (
    <>
      {corpo}
      {toast && (
        <div className="toast" onClick={() => setToast(undefined)}>
          {toast}
          <span className="muted pequeno"> (clique para fechar)</span>
        </div>
      )}
    </>
  );
}
