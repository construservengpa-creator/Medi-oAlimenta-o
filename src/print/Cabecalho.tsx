import type { ReactNode } from 'react';
import type { Aditivo, Contrato, Medicao } from '../lib/db';
import { dataTermino, prazoVigente } from '../lib/calc';
import { fmtDate } from '../lib/format';

export function BarraImpressao({ children }: { children?: ReactNode }) {
  return (
    <div className="print-barra">
      <button className="pri" onClick={() => window.print()}>Imprimir / salvar PDF</button>
      {children}
      <span className="espaco" />
      <button onClick={() => window.close()}>Fechar</button>
    </div>
  );
}

export function Cabecalho({ titulo, contrato, aditivos, medicao }: { titulo: string; contrato: Contrato; aditivos: Aditivo[]; medicao?: Medicao }) {
  return (
    <>
      <div className="cab">
        {contrato.logo && <img src={contrato.logo} alt="" />}
        <div style={{ flex: 1 }}>
          <h1>{titulo}</h1>
          <div>{contrato.contratante}</div>
        </div>
        {medicao && <div style={{ textAlign: 'right' }}><b>Período</b><br />{fmtDate(medicao.periodoInicio)} a {fmtDate(medicao.periodoFim)}<br />Emissão: {fmtDate(medicao.dataEmissao)}</div>}
      </div>
      <div className="info">
        <div><b>Contrato</b>{contrato.numero}</div>
        <div><b>Processo</b>{contrato.processo || '—'}</div>
        <div className="w2"><b>Contratada</b>{contrato.contratada} {contrato.cnpjContratada && `— CNPJ ${contrato.cnpjContratada}`}</div>
        <div className="w4"><b>Objeto</b>{contrato.objeto}</div>
        <div className="w2"><b>Local</b>{contrato.local || '—'}</div>
        <div><b>Início</b>{fmtDate(contrato.dataInicio)}</div>
        <div><b>Prazo / término</b>{prazoVigente(contrato, aditivos)} dias — {fmtDate(dataTermino(contrato, aditivos))}</div>
      </div>
    </>
  );
}

export function Assinaturas({ contrato }: { contrato: Contrato }) {
  return (
    <div className="assin">
      <div>{contrato.responsavelTecnico || 'Responsável técnico'}<br />{contrato.contratada}</div>
      <div>{contrato.fiscal || 'Fiscal do contrato'}<br />{contrato.contratante}</div>
    </div>
  );
}
