# Google Forms — Validação + Feedback MVP

Estruturas para o formulário de pesquisa do **PSP2 IA para Universitários**. Combina validação de hipóteses (problema/solução) com feedback do MVP em um único form, usando lógica condicional para bifurcar quem testou e quem não testou.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| [`estrutura-formulario.md`](estrutura-formulario.md) | Especificação humana — todas as seções, perguntas, tipos, opções e lógica condicional. Use como referência ao criar manualmente ou ao revisar/editar. |
| [`apps-script.gs`](apps-script.gs) | Google Apps Script que **cria o formulário automaticamente**. Rode uma vez no script.google.com e o form aparece pronto no seu Drive. |

## Caminho rápido — criar o form automaticamente

1. Vá em **https://script.google.com** logado na conta que vai dona do formulário.
2. **Novo projeto** → cole todo o conteúdo de `apps-script.gs` em `Code.gs` (substitua o boilerplate).
3. Salve (Ctrl/Cmd + S).
4. Selecione a função `createPSP2Form` no dropdown e clique **Executar**.
5. Autorize os escopos solicitados (FormApp).
6. Veja **Execution log** → o link de edição e o link público aparecem ali.

> ⚠ Cada execução cria um **novo** formulário. Se rodar duas vezes você terá duas cópias. Não edita o existente.

## Caminho manual — criar no Google Forms UI

1. Acesse https://forms.google.com → **Em branco**.
2. Configure título, descrição e mensagem de confirmação conforme `estrutura-formulario.md` (cabeçalho).
3. Em **⚙ Configurações**:
   - "Coletar endereços de email" → **Desligado**
   - "Limitar a 1 resposta" → **Desligado**
   - "Editar após enviar" → **Ligado**
   - "Mostrar barra de progresso" → **Ligado**
4. Copie seção por seção do markdown. Use:
   - **Múltipla escolha** para `multiple_choice`
   - **Caixas de seleção** para `checkbox`
   - **Lista suspensa** para `dropdown`
   - **Escala linear** para `linear_scale`
   - **Resposta curta** para `short_text`
   - **Parágrafo** para `long_text`
5. Para a bifurcação MVP (pergunta Q6.4), use **⋮ → Ir para seção com base na resposta**:
   - "Sim, testei" → Seção 6 (Contexto MVP)
   - "Não, ainda não testei" → Seção 8 (Encerramento)
6. No final de cada seção (em **⋮** do page break), configure "Após a seção X → continuar/ir para...":
   - Seção 7 (Feedback MVP) → ir para Seção 8 (Encerramento). *Já é o padrão se forem sequenciais.*

## Mapeamento perguntas ↔ hipóteses

| Hipótese | Validada por |
|---|---|
| H1 — Volume de docs espalhado | Q3.1, Q3.2, Q3.3 |
| H2 — Dor em sintetizar | Q3.4, Q4.1, Q4.2, Q4.4 |
| H3 — IA usada de forma fragmentada | Q5.1, Q5.2, Q5.4 |
| H4 — Querem prompts personalizados | Q5.5, Q6.2 |
| H5 — Pagariam por solução (price discovery) | Q6.3 |
| H6 — Google Drive é diferenciador | Q6.1, Q8.5 |
| F1–F6 — Features do MVP | Seção 8 inteira + NPS (Q9.1) |

## Métricas a acompanhar (após coletar respostas)

- **Taxa de conclusão** (% que chega ao envio) — esperado >60%.
- **% que respondeu MVP=Sim** — quantifica quem testou.
- **NPS** entre testers (Q9.1).
- **Top 3 dores** (Q4.4) — orienta priorização do backlog.
- **Top 3 features valiosas** (Q6.2) — alinhamento com roadmap.
- **Distribuição de preço** (Q6.3) — input pra modelo de negócio.
- **Taxa de aceite de entrevista** (Q9.3 = "Sim") — pipeline qualitativo.

## Roteiro de distribuição

1. **Grupos de WhatsApp** das turmas (UnB e parceiros)
2. **Stories no Instagram** com link na bio
3. **Email** para listas de centros acadêmicos
4. **Comunidades no Discord** de universitários
5. **LinkedIn** dos integrantes do time

Meta inicial: **80 respostas em 2 semanas**, com pelo menos 20 que testaram o MVP.

## Próximos passos depois da coleta

1. Exportar respostas para Google Sheets (botão automático no Forms).
2. Análise quantitativa: pivot tables das escalas e múltipla escolha.
3. Análise qualitativa: cluster temático dos campos de texto longo (Q8.8–Q8.10, Q9.2, Q9.5).
4. Documentar findings em `docs/pesquisa-validacao-resultados.md` (a criar).
5. Atualizar backlog de produto com priorização baseada em dados.
