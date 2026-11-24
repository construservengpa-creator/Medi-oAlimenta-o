import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) setMsg(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : /fetch|network/i.test(error.message) ? 'Sem conexão com o servidor. Verifique a internet.' : error.message);
  }

  async function esqueci() {
    if (!email.trim()) return setMsg('Informe o e-mail para receber o link de redefinição.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.href.split('#')[0] });
    setMsg(error ? error.message : 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
  }

  return (
    <div className="login">
      <form className="card" onSubmit={entrar}>
        <div className="marca" style={{ color: 'var(--txt)', marginBottom: '1rem' }}>
          <span className="marca-icone">▦</span> Medição de Obras
        </div>
        <p className="muted pequeno" style={{ marginTop: 0 }}>Entre com o mesmo e-mail e senha do Painel de Suprimentos.</p>
        <label className="campo">E-mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="campo" style={{ marginTop: '.6rem' }}>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
        <button className="pri" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }} disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="mini" style={{ marginTop: '.6rem', border: 0 }} onClick={esqueci}>Esqueci minha senha</button>
        {msg && <div className="aviso pequeno">{msg}</div>}
      </form>
    </div>
  );
}

export function AvisoAcesso({ titulo, texto, sair }: { titulo: string; texto: string; sair?: () => void }) {
  return (
    <div className="login">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        <p>{texto}</p>
        {sair && <button onClick={sair}>Entrar com outro usuário</button>}
      </div>
    </div>
  );
}
