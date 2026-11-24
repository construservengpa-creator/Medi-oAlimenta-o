# Sistema de Medição de Obras

Sistema web para gestão de contratos de obras: planilha orçamentária, cronograma físico-financeiro,
previsão financeira, medições com memória de cálculo e relatório fotográfico, e emissão do boletim de medição.

Funciona **offline** no navegador (dados em IndexedDB), inclusive no celular/tablet no canteiro.

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera a pasta dist/ (hospedagem estática: Vercel, Netlify, servidor interno…)
npm test           # testes das regras de cálculo
```

No painel, clique em **"Carregar contrato de exemplo"** para ver o sistema com dados.

## Módulos

| Módulo | O que faz |
|---|---|
| **Contratos** | Nº, processo, objeto, partes (CNPJ), fiscal, RT, início/prazo, BDI, logomarca, retenções (INSS, ISS, IRRF, caução…) com base de cálculo configurável |
| **Planilha orçamentária** | Etapas e itens (código, descrição, fonte SINAPI/SICRO, unidade, quantidade, preço unitário), peso de cada item, importação colando do Excel/CSV, exportação CSV |
| **Cronograma físico-financeiro** | % de execução por item e por mês, distribuição automática (linear) por item ou etapa, totais mensais e acumulados (R$ e %), impressão consolidada por etapa |
| **Previsão financeira** | Desembolso previsto x medido por mês, curva S, desvio acumulado e **previsão reprogramada** (saldo redistribuído nos meses futuros) para fluxo de caixa/empenho |
| **Medições** | Quantidades por item, acumulado anterior/período/acumulado/saldo, bloqueio ao exceder o contratado, reajuste sobre o período, fluxo rascunho → em análise → aprovada (bloqueada) |
| **Memória de cálculo** | Linhas por item com Qtd × Comp. × Larg. × Alt. ou fórmula livre (`(3,20+2,80)*2*2,70 - 0,80*2,10`), deduções negativas; a soma alimenta a medição |
| **Relatório fotográfico** | Upload múltiplo (câmera do celular), compressão automática, vínculo foto ↔ serviço, legenda/local/data, ordenação; impressão agrupada por item |
| **Boletim de medição** | Documento A4 paisagem com cabeçalho, planilha completa (ou só itens medidos), subtotais por etapa, resumo financeiro (bruto, retenções, líquido), situação do contrato e assinaturas; marca d'água "preliminar" até ser aprovado; exporta CSV |
| **Aditivos** | Prorrogação de prazo, acréscimos/supressões de quantidade, inclusão de itens novos; controle do limite de 25% (Lei 14.133/21, art. 125) |
| **Diário de obra (RDO)** | Clima manhã/tarde, efetivo, equipamentos, atividades, ocorrências; contagem de dias impraticáveis por chuva |
| **Painel e alertas** | Valor contratado/medido/saldo da carteira, avanço financeiro x previsto, prazo decorrido, alertas de prazo vencendo, atraso físico, item excedido, limite de aditivo |
| **Backup** | Exporta/importa todos os dados (com fotos) em JSON |

Todos os relatórios abrem em nova aba com botão **Imprimir / salvar PDF**.

## Estrutura

```
src/lib/db.ts          modelo de dados (Dexie/IndexedDB)
src/lib/calc.ts        regras: boletim, acumulados, aditivos, cronograma, previsão
src/lib/expr.ts        avaliador seguro de fórmulas da memória de cálculo
src/pages/             telas
src/print/             boletim, memória, relatório fotográfico, cronograma (impressão)
```

## Próximas etapas sugeridas

1. **Servidor e multiusuário** — migrar o armazenamento para Supabase/PostgreSQL (a camada de dados está isolada em `lib/db.ts` e `lib/hooks.ts`), com login e perfis: contratada (lança), fiscal (analisa/aprova), gestor (consulta).
2. **Assinatura e trilha de auditoria** — registrar quem lançou, alterou e aprovou cada medição; assinatura digital (gov.br / ICP-Brasil) no PDF.
3. **Reajuste automático** — índices (INCC, SINAPI, IPCA) com data-base, cálculo pela fórmula do contrato.
4. **Banco de composições** — importar SINAPI/SICRO/ORSE por estado e mês de referência, com composições analíticas e curva ABC.
5. **Fotos georreferenciadas** — gravar GPS/EXIF e carimbo de data/hora na imagem; mapa da obra.
6. **Cronograma por datas (Gantt)** com dependências entre etapas e caminho crítico.
7. **Medição de serviços por etapa/evento** (critério de medição por marcos, comum em obras por preço global).
8. **Controle financeiro** — notas fiscais, empenhos, liquidação e pagamentos vinculados a cada boletim.
9. **Exportação .xlsx/.pdf nativa** e envio do boletim por e-mail.
10. **Indicadores** — IDP/IDC (valor agregado), produtividade por equipe a partir do diário de obra.
