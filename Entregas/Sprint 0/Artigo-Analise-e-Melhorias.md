# 🔬 Artigo ENEGEP — Análise detalhada e melhorias (18/06/2026)

> Análise do corpo completo (`PSP2_Artigo_ENEGEP_Introducao.docx`, 6 seções + 26 refs).
> Foco em **melhorar sem inflar** (cortes, correções, decisões), conforme pedido.
> Veredito geral: **artigo forte, coerente e honesto**. Pronto na estrutura; precisa de
> ajustes pontuais de consistência e de uma decisão estratégica sobre resultados.

---

## A. Partes mais relevantes (preservar — é a espinha dorsal)

1. **§1.2 Problema + §2.3 Lacunas/posicionamento** — o coração do artigo. A tese ("automatizar a *preparação de contexto* que antecede a interação com a IA; gerar artefato **portátil** em vez de plataforma fechada") é original, bem delimitada e bem ancorada contra RAGMan/CourseAssist/DeepTutor. Não mexer na essência.
2. **§4 (Desenvolvimento do artefato)** — descrição reproduzível: 3 camadas, pipeline de 5 estágios, validação em 4 camadas, saída portátil. É o que sustenta o método DSR (o artefato é o resultado).
3. **§5 honesta** — "nenhum resultado empírico é reportado; optou-se por não apresentar valores simulados". Academicamente é uma força (integridade), não fraqueza — manter.
4. **Base de referências** — 26 refs, recentes (2024–2026) + clássicos de método (Hevner, Peffers, Dresch) e de avaliação (Brooke, Davis, Bardin). Boa cobertura.

---

## B. Melhorias priorizadas

Legenda do tipo: ✂️ corte/enxugar · ✏️ edição/correção · ⚖️ decisão · 🔎 verificar.

### 🔴 Alta prioridade

1. **✏️ Corrigir o Objetivo SMART — Temporal (§1.4.3).** Hoje diz *"protótipo funcional testado até 09 de junho de 2026, entrega final... até 09 de julho de 2026"*. Dois problemas: (a) "testado" **contradiz** a Seção 5 (testes não executados); (b) datas do plano antigo (deadline real 25/06; 5 sprints). **Ação:** reescrever a frase Temporal alinhada às 5 sprints e remover a afirmação de teste. Edição de 1 frase.

2. **⚖️ Executar a validação TÉCNICA (50 docs) e popular a Tabela 1 com números reais.** É a melhoria de **maior alavancagem** do artigo. Diferente da avaliação com usuários, a validação técnica **não precisa de deploy público nem de usuários** — só rodar o pipeline localmente sobre 50 documentos (custa créditos de LLM). Renderia, sem fabricar nada: taxa de classificação correta, taxa de aprovação na validação, custo médio/doc e latência p50/p95. Transformaria o artigo de "só artefato" para "artefato + resultados técnicos", mantendo a honestidade sobre a parte com usuários. **Conecta direto com o roadmap/PIBIC.**

3. **✂️ Folga de páginas (está em 14/14 — no limite).** Risco real de estourar na formatação final. Cortar redundância **antes** de qualquer adição:
   - §1.1/§1.2/§1.3 repetem o contexto "material disperso em SIGAA/e-mail/WhatsApp" — dizer uma vez.
   - §3.4 e §3.5 descrevem os instrumentos (SUS/TAM/cronometragem/entrevista) com sobreposição — condensar.
   - Os **2 parágrafos novos da §4** (hardening + jornada) somam ~0,5 página; se faltar espaço, fundir em **um** parágrafo enxuto. (Mantêm o conteúdo de Sprint 3/5 no artigo, como você pediu, mas sem custo de página alto.)

### 🟡 Média prioridade

4. **🔎 Verificar citações de preprint com ano futuro.** Várias refs são "arXiv preprint" e algumas datam **2026** (Zhao; Furst e Venkateshwaran). Conferir se existem de fato (risco de citação inverificável) e, onde possível, **trocar preprint por versão publicada** (proceedings/journal) — fortalece o aceite por pares. Manter ao menos 2–3 fontes brasileiras revisadas (já há Lacerda 2013, Silva & Kampff 2025, CGI.br 2025).

5. **✏️ Alinhar números entre seções.** §1.3 diz "reduzir em até **50-60%**"; o SMART diz "**≥50%**"; §1.1 fala em "**3-5 horas semanais**". Padronizar (sugiro fixar "≥50%" e "3–5 h/semana" e remover o "60%" solto).

6. **✏️ Tabela 1 com pouca informação.** A 3ª coluna é "Implementado" repetido 9×. Ou (a) discriminar o estado (ex.: "Implementado; validação técnica pendente" vs "Implementado e demonstrado"), ou (b) substituir a tabela por um parágrafo. Ganha densidade sem inflar. *(Se executar a melhoria #2, a Tabela 1 pode virar a tabela de métricas reais — solução ideal.)*

7. **⚖️ Contraste do "98% do RAGMan" (§2.2).** Citar 98% de precisão de outro sistema, num artigo que não reporta números próprios, pode soar desfavorável. Não é erro; considerar uma meia-frase situando que é outro domínio/tarefa, ou mover o número para o final da discussão como parâmetro-alvo.

### 🟢 Baixa prioridade (revisão final / formatação — T58)

8. **✏️ Itálico em termos estrangeiros** (exigência do template): *large language models*, *system prompt*, *Retrieval-Augmented Generation*, *prompt engineering*, *Custom GPTs*, *Claude Projects*, *Gemini Gems*, *deploy*. Conferir em todo o corpo.
9. **✏️ Cor do texto:** o draft está em cinza `#333333`; reajustar para **preto puro `#000000`** antes do PDF.
10. **✏️ Consistência de termo:** "matérias" vs "disciplinas" — escolher um (sugiro "disciplinas" no corpo formal).
11. **✏️ Capa:** confirmar sobrenomes completos dos coautores e nome do orientador(a); resumo ≤ 250 palavras; 3–5 palavras-chave.

---

## C. O que NÃO mudar

- A moldura honesta da §5/§6 (sem números fabricados). É um diferencial de integridade.
- A tese de portabilidade (§2.3) e a descrição do pipeline (§4).
- A escolha metodológica (DSR) e a estrutura de seções.

---

## D. Recomendação única de maior impacto

> **Rodar a validação técnica dos 50 documentos antes da submissão.** É factível sem deploy
> e sem usuários, custa apenas créditos de LLM, e converte a Seção 5 de "protocolo planejado"
> para "artefato + resultados técnicos reais" — o maior ganho de força acadêmica possível
> mantendo 100% da honestidade. Naturalmente vira o **primeiro item do plano de trabalho do PIBIC**.
