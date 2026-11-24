import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useContrato, type DadosContrato } from '../lib/hooks';
import { StatusContrato } from '../components/ui';

export function useDados() {
  return useOutletContext<DadosContrato>();
}

export default function ContratoLayout() {
  const { id } = useParams();
  const d = useContrato(id);
  if (d === undefined) return null;
  if (d === null) return <p>Contrato não encontrado.</p>;
  const c = d.contrato;
  return (
    <>
      <div className="linha">
        <div>
          <h1>Contrato {c.numero} <StatusContrato s={c.status} /></h1>
          <div className="muted">{c.objeto} · {c.contratada}</div>
        </div>
      </div>
      <nav className="abas">
        <NavLink to="" end>Resumo</NavLink>
        <NavLink to="planilha">Planilha</NavLink>
        <NavLink to="cronograma">Cronograma físico-financeiro</NavLink>
        <NavLink to="previsao">Previsão financeira</NavLink>
        <NavLink to="medicoes">Medições</NavLink>
        <NavLink to="aditivos">Aditivos</NavLink>
        <NavLink to="diario">Diário de obra</NavLink>
        <NavLink to="editar">Dados do contrato</NavLink>
      </nav>
      <Outlet context={d} />
    </>
  );
}
