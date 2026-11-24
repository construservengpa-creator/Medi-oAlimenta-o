# Banco de dados (projeto Supabase `painel_suprimentos`)

As migrações `medobra_schema` e `medobra_search_path` já foram aplicadas no projeto.
Elas criam, sem alterar nada do painel existente:

- tabelas `public.medobra_*` (contratos, aditivos, itens, cronograma, medicoes, memoria, fotos, diario, auditoria) com RLS;
- funções `private.medobra_*` (permissões a partir da Central de Acessos) e `public.medobra_obras()`;
- gatilhos do fluxo da medição (rascunho → em análise → aprovada, bloqueio após aprovação, trilha de quem enviou/aprovou);
- bucket privado `medobra-fotos` (caminho `contrato/medicao/foto.jpg`) com políticas próprias.

E cadastram a aplicação `medicao-obras` na Central de Acessos (`acesso_aplicacoes`, `acesso_permissoes`, `acesso_perfis`).

## Permissões

| Código | Libera |
|---|---|
| `medobra.admin` | tudo: contratos, planilha, cronograma, aditivos, exclusões |
| `medobra.lancar` | medições, memória de cálculo, fotos, diário; enviar para análise |
| `medobra.aprovar` | aprovar, devolver e reabrir medições |
| (nenhuma) | consulta e impressão |

Perfis criados: Administrador, Engenheiro de medição, Fiscal, Consulta.
A visibilidade segue as obras liberadas ao usuário na Central (ou "todas as obras").
Contratos sem obra vinculada só aparecem para quem tem acesso a todas as obras.
