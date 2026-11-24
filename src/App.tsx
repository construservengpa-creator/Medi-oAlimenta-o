import { Link, NavLink, Route, Routes } from 'react-router-dom';
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
    <Routes>
      <Route path="/imprimir/boletim/:mid" element={<BoletimPrint />} />
      <Route path="/imprimir/memoria/:mid" element={<MemoriaPrint />} />
      <Route path="/imprimir/fotos/:mid" element={<FotosPrint />} />
      <Route path="/imprimir/cronograma/:id" element={<CronogramaPrint />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  );
}

function Shell() {
  return (
    <div className="app">
      <header className="topo">
        <Link to="/" className="marca">
          <span className="marca-icone">▦</span> Medição de Obras
        </Link>
        <nav>
          <NavLink to="/" end>Painel</NavLink>
          <NavLink to="/contratos/novo">Novo contrato</NavLink>
          <NavLink to="/backup">Backup</NavLink>
        </nav>
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
