import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { PortaoAcesso, usePerm } from './lib/acesso';
import { assinarPendentes } from './lib/db';
import { AvisoAcesso, Login } from './pages/Login';
import Painel from './pages/Painel';
import ContratoForm from './pages/ContratoForm';
import ContratoLayout from './pages/ContratoLayout';
import Resumo from './pages/Resumo';
import Planilha from './pages/Planilha';
import Cronograma from './pages/Cronograma';
import Previsao from './pages/Previsao';
import Medicoes from './pages/Medicoes';
import MedicaoEditor from './pages/MedicaoEditor';
import Aditivos from './pages/Aditivos';
import DiarioObra from './pages/DiarioObra';
import Backup from './pages/Backup';
import BoletimPrint from './print/BoletimPrint';
import MemoriaPrint from './print/MemoriaPrint';
import FotosPrint from './print/FotosPrint';
import CronogramaPrint from './print/CronogramaPrint';

export default function App() {
  return (
    <PortaoAcesso Login={Login} Aviso={AvisoAcesso}>
      <Rotas />
    </PortaoAcesso>
  );
}

function Rotas() {
  return (
    <Routes>
      <Route path="/imprimir/boletim/:mid" element={<BoletimPrint />} />
      <Route path="/imprimir/memoria/:mid" element={<MemoriaPrint />} />
      <Route path="/imprimir/fotos/:mid" element={<FotosPrint />} />
      <Route path="/imprimir/cronograma/:id" element={<CronogramaPrint />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  );
}

function Salvando() {
  const [n, setN] = useState(0);
  useEffect(() => assinarPendentes(setN), []);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (n > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [n]);
  return <span className="salvando">{n > 0 ? 'Salvando…' : 'Tudo salvo'}</span>;
}

function Shell() {
  const perm = usePerm();
  return (
    <div className="app">
      <header className="topo">
        <Link to="/" className="marca">
          <span className="marca-icone">▦</span> Medição de Obras
        </Link>
        <nav>
          <NavLink to="/" end>Painel</NavLink>
          {perm.admin && <NavLink to="/contratos/novo">Novo contrato</NavLink>}
          <NavLink to="/backup">Exportar dados</NavLink>
        </nav>
        <span className="espaco" style={{ flex: 1 }} />
        <Salvando />
        <span className="salvando" title={perm.email}>{perm.nome} · {perm.perfil}</span>
        <button className="mini" onClick={perm.sair}>Sair</button>
      </header>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/contratos/novo" element={<ContratoForm />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/contratos/:id" element={<ContratoLayout />}>
            <Route index element={<Resumo />} />
            <Route path="editar" element={<ContratoForm />} />
            <Route path="planilha" element={<Planilha />} />
            <Route path="cronograma" element={<Cronograma />} />
            <Route path="previsao" element={<Previsao />} />
            <Route path="medicoes" element={<Medicoes />} />
            <Route path="medicoes/:mid" element={<MedicaoEditor />} />
            <Route path="aditivos" element={<Aditivos />} />
            <Route path="diario" element={<DiarioObra />} />
          </Route>
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}
