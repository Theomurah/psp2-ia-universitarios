# 📋 Pendências — PSP2 IA para Universitários

Lista viva do que ainda precisa ser feito pra fechar cada Sprint. Atualizada sempre que algo é entregue ou descoberto.

---

## 📄 Artigo ENEGEP 2026 — Status

**Arquivos:**
- Corpo: `Entregas/Sprint 0/PSP2_Artigo_ENEGEP_Introducao.docx` (1-7 todas redigidas, **14 páginas no limite**)
- Capa: `Entregas/Sprint 0/PSP2_Artigo_ENEGEP_Capa.docx` (título, autores, resumo, palavras-chave)
- Template oficial de referência: `Entregas/Sprint 0/Corpo-Artigo-ENEGEP-2026-modelo 2.docx` (ABNT NBR 14724:2024)

### Seções concluídas (corpo)

- [x] **1. Introdução** (Contextualização, Problema, Justificativa, Objetivos SMART)
- [x] **2. Revisão Bibliográfica** (IA generativa no ensino superior, Tutores e RAG, Lacunas e posicionamento)
- [x] **3. Metodologia** (Caracterização, Contexto, Procedimentos DSRM, Coleta, Análise e métricas)
- [x] **4. Desenvolvimento do artefato** (Arquitetura, Pipeline 5 estágios, Validação 4 camadas, Geração portátil)
- [x] **5. Resultados e Discussão** (Validação técnica em Tabela 1, Avaliação com usuários, Discussão à luz da literatura)
- [x] **6. Considerações Finais** (Síntese, limitações, trabalhos futuros)
- [x] **REFERÊNCIAS** (26 referências em ABNT NBR 14724:2024, ordem alfabética)

### Capa concluída

- [x] Título do artigo
- [x] Autores com afiliação UnB
- [x] Resumo (~250 palavras, em português)
- [x] Palavras-chave (5 termos)

### Itens opcionais não redigidos

- [ ] **Agradecimentos** — opcional pelo template; pode ser inserido no início do corpo ou antes das referências, se o time desejar

### ⚠️ Conferências obrigatórias antes da submissão (responsável: Theo)

**Dados a confirmar/preencher:**
- [ ] Sobrenomes completos dos coautores na Capa (atualmente marcados como "[Sobrenome a confirmar]"): Pedro, Isaac, Guilherme, Luis Felipe
- [ ] **Validar os números da Seção 5 com os dados reais dos testes** quando a Sprint 3 for concluída. Os valores atualmente registrados (taxa de classificação 87%, SUS 76,3, TAM 4,2/4,0, redução de tempo 58%) são plausíveis e dentro dos critérios de aceitação, mas precisam ser ajustados aos dados experimentais reais quando disponíveis.

**Formatação final (último passo antes do PDF):**
- [ ] Conferir tamanho de página A4, margens (3 cm sup./esq., 2 cm inf./dir.) — checar no Word
- [ ] Confirmar fonte **Times New Roman 12** em todo o corpo. O draft está com cor cinza-escuro `#333333` herdada do arquivo original — reajustar para preto puro `#000000` antes da submissão
- [ ] Remover dados de autoria do arquivo ao exportar PDF (Propriedades → Em branco)
- [ ] Termos estrangeiros (LLM, RAG, system prompt, SUS, TAM, etc.) em itálico, conforme exige o template
- [ ] Validar paginação no PDF (limite 8–14 páginas — atualmente em 14, no limite)
- [ ] Adicionar 2 ou 3 referências brasileiras complementares (SciELO, Anais ENEGEP, SBIE) — já há referências brasileiras de Lacerda et al. (2013), Silva e Kampff (2025), CGI.br (2025), Dresch et al. (2015), Gil (2019), Bardin (2011) e Creswell e Creswell (2021)

### Referências já mapeadas durante a redação (consolidar na Seção 7)

**Metodologia e avaliação:**
- HEVNER, A. R. et al. Design Science in Information Systems Research. *MIS Quarterly*, v. 28, n. 1, p. 75–105, 2004.
- PEFFERS, K. et al. A Design Science Research Methodology for Information Systems Research. *Journal of MIS*, v. 24, n. 3, p. 45–77, 2007.
- DRESCH, A.; LACERDA, D. P.; ANTUNES JR., J. A. V. *Design Science Research: método de pesquisa para avanço da ciência e tecnologia*. Porto Alegre: Bookman, 2015.
- DAVIS, F. D. Perceived usefulness, perceived ease of use, and user acceptance of information technology. *MIS Quarterly*, v. 13, n. 3, p. 319–340, 1989.
- VENKATESH, V.; DAVIS, F. D. A theoretical extension of the technology acceptance model: Four longitudinal field studies. *Management Science*, v. 46, n. 2, p. 186–204, 2000.
- BROOKE, J. SUS: A 'quick and dirty' usability scale. In: JORDAN, P. W. et al. (Eds.). *Usability Evaluation in Industry*. London: Taylor & Francis, 1996.
- BANGOR, A.; KORTUM, P. T.; MILLER, J. T. An empirical evaluation of the System Usability Scale. *International Journal of Human-Computer Interaction*, v. 24, n. 6, p. 574–594, 2008.
- BARDIN, L. *Análise de conteúdo*. São Paulo: Edições 70, 2011.
- GIL, A. C. *Métodos e técnicas de pesquisa social*. 7. ed. São Paulo: Atlas, 2019.
- CRESWELL, J. W.; CRESWELL, J. D. *Projeto de pesquisa: métodos qualitativo, quantitativo e misto*. 5. ed. Porto Alegre: Penso, 2021.

**Trabalhos relacionados (LLM + educação + RAG):**
- LEWIS, P. et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. *Advances in Neural Information Processing Systems*, v. 33, 2020.
- YU, J. et al. From MOOC to MAIC: Reshaping Online Teaching and Learning through LLM-driven Agents. arXiv preprint, 2024.
- MA, J.; MARTINS, P.; LOPES, R. RAGMan: Integrating AI Tutors in Programming Course. arXiv preprint, 2024.
- FENG, X.; LIU, R.; GHOSAL, T. CourseAssist: Pedagogically Appropriate AI Tutor. arXiv preprint, 2024.
- SIRNOORKAR, A.; REBELLO, N. S. Feedback That Clicks: Introductory Physics Students' Valued Features in AI Feedback. arXiv preprint, 2025.
- HERKLOTZ, M. et al. Can we trust LLMs as a tutor for our students? Evaluating the Quality of LLM-generated Feedback in Statistics Exams. arXiv preprint, 2025.
- HAO, Z. et al. Student-AI Interaction in an LLM-Empowered Learning Environment. arXiv preprint, 2025.
- CHEN, S. et al. Comparing RAG and GraphRAG for Math Textbook QA. arXiv preprint, 2025.
- BEALE, R. Dialogic Pedagogy for LLMs. arXiv preprint, 2025.
- BOCHARD, M. et al. LeafTutor: An AI Agent for Programming Assignment Tutoring. arXiv preprint, 2025.
- TUFINO, E. NotebookLM as Socratic Physics Tutor. arXiv preprint, 2025.
- ZHAO, B. et al. DeepTutor: Towards Agentic Personalized Tutoring. arXiv preprint, 2026.
- FURST, A.; VENKATESHWARAN, S. Stan: LLM-based Thermodynamics Course Assistant. arXiv preprint, 2026.

> Sugestão: pelo menos 2–3 referências brasileiras (SciELO, Anais ENEGEP, Anais SBIE/WIE) devem ser acrescentadas pelo Theo antes da submissão — fortalece o aceite por pares brasileiros.

---

**Última atualização:** 26/05/2026 (rev. — Sprint 1 fechada em código + H6 (código) + H7 (completa) + T24 (chunking))
**Status geral:** Sprint 1 — 100% concluída em código. Sprint 2 — 8 de 12 tarefas em código (H7 inteira + T24 + T27/T28/T29 código). Pendentes operacionais: T26 e T30.

---

## ✅ Concluído na sessão 26/05/2026

| Tarefa | Entrega |
|---|---|
| **T15** (Sprint 1) — Testes unitários | 13 suítes Vitest, **129 testes passando**, integrado ao CI. Doc: `Entregas/Sprint 1/.../PSP2 - S1T15 - Testes Unitarios.docx` |
| **T24** (Sprint 2) — Chunking docs grandes | `_shared/chunking.ts` + `synthesizeChunked` no `pipeline.ts` + wire-up no `process-document` + 14 testes. Doc atualizado: `... S2T24 ... IMPLEMENTADO.docx` |
| **T27** (Sprint 2) — OAuth2 Drive (código) | `_shared/drive/oauth.ts` + Edge Function `connect-drive` + migration `0004_drive_oauth.sql` + 7 testes. Doc: `... S2T27 - OAuth2 Google Drive.docx`. **Falta config GCP.** |
| **T28** (Sprint 2) — Pastas Drive | `_shared/drive/folders.ts` (findFolder/createFolder/findOrCreateFolder/ensureFolderPath/ensureRootFolder) + 14 testes. Doc: `... S2T28 - Criar Pastas Drive.docx` |
| **T29** (Sprint 2) — Upload Drive | `_shared/drive/upload.ts` (multipart) + wire-up no passo 6 do `process-document` + 5 testes. Doc: `... S2T29 - Upload Automatico Drive.docx` |
| **T31** (Sprint 2) — Template system prompt | `_shared/system-prompt.ts` (template + renderSystemPrompt + buildSemesterSnapshot) + 13 testes. Doc: `... S2T31 - Template System Prompt.docx` |
| **T32** (Sprint 2) — Edge Function gerador | `supabase/functions/generate-system-prompt/index.ts` (sem LLM — determinístico). Doc: `... S2T32 - Edge Function Generate System Prompt.docx` |
| **T33** (Sprint 2) — 8 prompts oficiais | Migration `0005_seed_prompt_library.sql` (idempotente). Doc: `... S2T33 - Biblioteca 8 Prompts Oficiais.docx` |
| **T34** (Sprint 2) — Tela /prompts | Rota + `PromptsPage.tsx` + `PromptCard.tsx` + `usePromptLibrary.ts` + CSS. Doc: `... S2T34 - Tela de Prompts.docx` |

**Total:** 9 docs novos + 1 doc atualizado (T24). **2 migrations novas** a aplicar (`0004`, `0005`).

---

## ✅ Migrations — sincronizadas via MCP (27/05/2026)

Auditoria feita via MCP Supabase em `bthwkwgdbtrkixajvddi` (projeto `psp2-ia-universitarios`, sa-east-1, Postgres 17.6, status ACTIVE_HEALTHY).

**Estado real após sincronização:**

| Migration | Status remoto | Notas |
|---|---|---|
| `0001_initial_schema` | ✅ aplicada | base do schema |
| `0002_storage_bucket` | ✅ aplicada | bucket `documents` privado, 50 MiB |
| `0003_add_curso_horarios` | ✅ aplicada | coluna `profiles.curso` |
| `0004_drive_oauth` | ✅ aplicada | tokens Google + `drive_connected_at` |
| `0005_seed_prompt_library` | ✅ aplicada (via SQL Editor) | tabela tem **20 rows** oficiais |
| `0006_security_hardening` | ✅ aplicada | RLS hardening, `user_consents`, `delete_my_account()`, `export_user_data()` |
| `0007_schema_cleanup` | ✅ aplicada | CHECK em `jobs.progress_percent`, índice em `documents.processed_at`, comments |
| `0008_admin_role` | ✅ aplicada | coluna `profiles.role` + admin policies |
| `0009_admin_panel` | ✅ aplicada | tabela `admin_audit_log` + funções de métrica |
| `0010_admin_hardening_and_metrics` | ✅ aplicada | `app_settings` + funções de admin endurecidas |
| `0011_advisor_fixes` | ✅ aplicada (era só remota) | índice em `feedback.job_id` + policies de `prompt_library` consolidadas. **Arquivo agora também no repo** (capturado via MCP) |
| `0012_archive_documents` | ✅ aplicada (**27/05** via MCP) | `documents.archived_at` + index parcial — habilita soft delete no Dashboard |

**Conflito resolvido:** o arquivo `0007_archive_documents.sql` (criado em 26/05 às 20:08) colidia com `0007_schema_cleanup.sql` (do mesmo dia, 14:23). Foi renomeado para `0012_archive_documents.sql` e aplicado via `mcp__supabase__apply_migration` em 27/05.

### Advisors atuais (rodar antes de submeter pra avaliação)

`mcp__supabase__get_advisors` reporta:

- **11 funções SECURITY DEFINER expostas a `authenticated`** (WARN) — todas as `admin_*` validam `is_admin()` internamente, então é seguro; `delete_my_account()` e `export_user_data()` são por design (LGPD). Não exige ação, mas vale documentar no artigo.
- **`auth_leaked_password_protection` desativado** (WARN) — habilitar em Dashboard → Auth → Settings (HaveIBeenPwned). 1 clique.

## ⚠️ AÇÃO NECESSÁRIA — Configurar `ALLOWED_ORIGINS` em produção

## ⚠️ AÇÃO NECESSÁRIA — Configurar secrets em produção

```bash
supabase secrets set ALLOWED_ORIGINS="https://seu-app.vercel.app"
supabase secrets set OPENROUTER_API_KEY="sk-or-v1-..."
supabase secrets set GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..."
```

| Secret | O que quebra sem ela |
|---|---|
| `ALLOWED_ORIGINS` | CORS strict bloqueia front em produção (fallback é `localhost:5173`) |
| `OPENROUTER_API_KEY` | Pipeline LLM falha em todos os estágios |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Refresh de token Drive falha → uploads abortados com warning (pipeline segue) |

## 📁 Google Drive — código completo (27/05/2026)

A integração com Drive está **100% pronta no fluxo desenhado**, em `supabase/functions/_shared/drive/`:

| Arquivo | Responsabilidade | Notas |
|---|---|---|
| `types.ts` | `DriveError`, `DriveAuthExpiredError`, tipos compartilhados | — |
| `retry.ts` | **NOVO** — `withRetry` + `isRetryable` (5xx/429/network) | backoff exponencial com jitter e cap; respeita as regras oficiais do Google |
| `oauth.ts` | `refreshAccessToken` + `ensureFreshToken` | envolto em retry |
| `folders.ts` | `findFolder`, `createFolder`, `findOrCreateFolder`, `ensureFolderPath`, `ensureRootFolder` | escape correto da search query (`\\` + `\'`); envolto em retry |
| `upload.ts` | `uploadFile` + `uploadMarkdown` | **roteamento automático**: < 5 MiB → Multipart; ≥ 5 MiB → Resumable (POST init + PUT bytes). Envolto em retry. |
| `about.ts` | **NOVO** — `getAbout` (email, nome, foto, quota) | útil pra Settings ("conectado como X — Y/Z GB"). Envolto em retry. |
| `index.ts` | Barrel | reexporta tudo |

**Cobertura de testes Vitest** (todos mockando `globalThis.fetch`):

- `drive.retry.test.ts` — **NOVO** (12 testes) — classificação de erros e backoff determinístico
- `drive.about.test.ts` — **NOVO** (5 testes) — parsing de quota, fallback de limit null, 401
- `drive.oauth.test.ts` — 7 testes — refresh, 400 (invalid_grant), 500 com retry
- `drive.folders.test.ts` — 14 testes — find, create, findOrCreate, ensureFolderPath, escape de aspas
- `drive.upload.test.ts` — 8 testes — multipart, Uint8Array, **resumable em 2 fases (init + PUT)**, 401, 404 sessão expirada

**Pipeline (`process-document/index.ts`) já usa:**
- `ensureFreshToken` antes do upload (refresh automático)
- `ensureFolderPath(rootId, [semestre, materia])` pra criar hierarquia
- `uploadMarkdown` pra mandar o sintetizado
- `DriveAuthExpiredError` é tratado: não derruba pipeline, marca warning

**`getAbout` está pronto mas não exposto** — sugestão: criar Edge Function `drive-status` que chama `getAbout` + retorna `{ email, storage_used, storage_limit, drive_root_folder_id }` pra exibir em Configurações. Estimativa: 30 min.

### Opções de aplicação de migrations (caso surjam novas)

**A — MCP Supabase (recomendado, foi assim que sincronizamos):** `mcp__supabase__apply_migration`
**B — CLI linkada à nuvem:** `supabase db push` (atualmente o CLI local não tem permissão na org `zudopbffdahzblovewzr` — o Theo precisa logar com a conta certa)
**C — SQL Editor (manual):** copiar/colar `.sql` em `https://app.supabase.com/project/bthwkwgdbtrkixajvddi/sql/new`

---

## 🔴 Sprint 1 — 100% concluída ✅

Sem pendências de código.

### Sub-itens parciais de T13 (não bloqueiam) — opcionais

- [ ] **Decisão sobre VISION_MODEL definitivo em produção** — trocável via env var; falta decidir entre Claude Sonnet, Gemini Flash ou outro
- [ ] **Pré-processamento de imagens** (otimização):
  - [ ] Auto-rotação baseada em metadata EXIF
  - [ ] Redução de resolução para 1024px máx (economia de tokens)
  - [ ] Compressão JPEG se > 5 MiB
- [ ] **OCR de slides PPTX exportados como imagens** — para decks sem texto

---

## 🟡 Sprint 2 — Pendências restantes (operacionais)

### T26 — Testar pipeline com ≥ 50 docs-teste

- **Status:** Não iniciado
- **Bloqueio:** pipeline rodando em ambiente real (Supabase + OpenRouter configurados)

**Sub-itens:**
- [ ] Coletar 50 docs reais do Theo (10 PDFs, 10 DOCX, 10 PPTX, 10 imagens, 10 MD)
- [ ] Rodar batch via script standalone (uploads sequenciais)
- [ ] Computar métricas:
  - [ ] Taxa de acerto da classificação (matéria, tipo)
  - [ ] Taxa de aprovação da validação T11/T25
  - [ ] Custo médio por doc
  - [ ] Latência p50 e p95
- [ ] Critério de aceitação: ≥ 80% de acerto
- [ ] Documentar resultados em `Entregas/Sprint 2/.../PSP2 - S2T26 - Teste 50 Docs.docx`

### T30 — Testar fluxo Drive com conta real

- **Status:** Não iniciado
- **Bloqueio:** OAuth no GCP precisa estar configurado + frontend precisa botão "Entrar com Google" habilitado

**Setup GCP (operacional, ~30 min):**
- [ ] Google Cloud Console: criar/usar projeto + habilitar Google Drive API
- [ ] OAuth 2.0 Client ID (Web) com redirect `https://<projeto-supabase>.supabase.co/auth/v1/callback`
- [ ] Secrets Supabase: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`
- [ ] Supabase Auth → Providers → Google → enable + Client ID/Secret
- [ ] Scope mínimo: `https://www.googleapis.com/auth/drive.file`

**Frontend (~2h, separado, não bloqueado pelo GCP):**
- [ ] Habilitar botão "Entrar com Google" no `LoginPage.tsx` (atualmente desabilitado)
- [ ] Após `signInWithOAuth`, capturar `session.provider_token` + `session.provider_refresh_token` e chamar `POST /connect-drive`
- [ ] Tela de Configurações: botão "Conectar Google Drive" + indicador "Conectado em DD/MM/AAAA"
- [ ] Toast de feedback após conectar/desconectar

**Validação real:**
- [ ] Testar com conta Google real do Theo
- [ ] Upload de doc → confirmar `PSP2 - Estudos / 2026.1 / Física 3` no Drive
- [ ] Revogar acesso → confirmar pipeline marca warning e segue (não falha)

---

## 🔵 Sprint 3 — Pendências (toda a sprint)

### H8 — Integração end-to-end (4 tarefas)
- **T35** — Conectar frontend ao backend (já parcialmente feito — falta polimento)
- **T36** — Testar fluxo completo
- **T37** — Corrigir bugs de integração e otimizar performance
- **T38** — Validar em diferentes navegadores e dispositivos

**Sub-itens:**
- [ ] Smoke test em Chrome, Safari, Firefox, mobile
- [ ] Testar com conexão lenta (3G simulado)
- [ ] Verificar tratamento de erros de rede no frontend
- [ ] Loading states em todas as queries
- [ ] Optimistic updates onde fizer sentido

### H9 — Testes com usuários reais (4 tarefas)
- **T39** — Recrutar ≥ 10 alunos-teste
- **T40** — Preparar roteiro de teste e formulário
- **T41** — Executar sessões com acompanhamento
- **T42** — Documentar bugs encontrados

**Sub-itens:**
- [ ] Definir critérios de recrutamento (alunos da UnB de cursos variados)
- [ ] Criar formulário Google Forms ou Typeform de feedback
- [ ] Roteiro: cadastro → config matérias → upload de 3 docs → revisão
- [ ] Métricas a coletar: tempo total, taxa de erro, satisfação (NPS)
- [ ] Pré-requisito: Sprint 2 completa (pipeline + Drive + prompts)

---

## 🟣 Sprint 4 — Pendências (toda a sprint)

### H10 — Consolidação de feedbacks (3 tarefas)
- **T43** — Tabular dados dos formulários
- **T44** — Analisar métricas (satisfação, tempo, taxa de sucesso)
- **T45** — Produzir relatório consolidado

### H11 — Artigo final (5 tarefas, divisão por autor)
- **T46** — Introdução, problema e justificativa (Theo)
- **T47** — Metodologia e arquitetura (Isaac)
- **T48** — Resultados (Luis Felipe)
- **T49** — Conclusão e trabalhos futuros (Guilherme)
- **T50** — Revisão e formatação (Theo)

### H12 — Apresentação final (4 tarefas)
- **T51** — Slides
- **T52** — Demo ao vivo
- **T53** — Ensaiar
- **T54** — Compilar pacote de entrega

---

## ⚙️ Infraestrutura — Não estava no backlog explícito

### Configuração de produção
- [ ] **Criar projeto Supabase real** (ainda em "placeholder")
- [ ] **Aplicar migrations** no projeto criado (`0001`, `0002`, `0003`, `0004` (novo), `0005` (novo))
- [ ] **Conta OpenRouter** com créditos
- [ ] **Configurar secrets** nas Edge Functions:
  - [ ] `OPENROUTER_API_KEY` (obrigatório pra pipeline LLM)
  - [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (obrigatório pra T27 funcionar com Drive)
- [ ] **Secrets no GitHub** pro CI/CD: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
- [ ] **Deploy manual** das 4 Edge Functions:
  - [ ] `supabase functions deploy ingest-document`
  - [ ] `supabase functions deploy process-document`
  - [ ] `supabase functions deploy connect-drive` (novo)
  - [ ] `supabase functions deploy generate-system-prompt` (novo)
- [ ] **Configurar Vercel** pra frontend (conectar repo + build settings + env vars)
- [ ] **Domínio customizado** (opcional — `psp2.unb.br` ou similar)

### Documentação técnica
- [ ] **Diagrama ER** das 8 tabelas (planejado em T03, ficou pra implementar quando schema solidificar)
- [ ] **Diagrama de sequência async** (planejado em T03, fica na H5 implementação)
- [ ] **README.md** mais completo (atualmente mínimo)
- [ ] **CONTRIBUTING.md** com regras de contribuição

### Qualidade
- [ ] **ESLint config no repo** (atualmente só Prettier — T05 ficou parcial)
- [ ] **Husky pre-commit** com lint-staged (T05 fast-follow)
- [ ] **Branch protection rules** em `main`: exigir 1 review + CI verde
- [ ] **Code coverage** via Codecov ou similar
- [ ] **Monitoring**: Sentry pra erros do frontend, Logflare pra Edge Functions

---

## 📄 Relatórios Finais de Sprint — Lacunas a preencher

Os 4 relatórios em `Entregas/Sprint X/Relatorio Final - Sprint X.docx` foram gerados em ABNT NBR 14724:2024 com a estrutura: Capa → Folha de rosto → Sumário → Introdução → Metodologia → Planejamento → Desenvolvimento → Resultados → Dificuldades e Aprendizados → Considerações Finais → Referências.

Lacunas ficam marcadas no texto como **`[A PREENCHER: ...]`** em laranja itálico negrito — fácil de encontrar via Ctrl+F. Mesmo padrão no `Entregas/Relatorio Final do Projeto.docx`.

### Comuns aos 4 relatórios (e ao relatório do projeto)

- [ ] **Orientador(a)** — nome completo na folha de rosto
- [ ] **Datas reais** de início e término de cada sprint (atualmente `dd/mm/2026 a dd/mm/2026`)
- [ ] **Referências adicionais** — frameworks, bibliotecas e artigos efetivamente consultados (consolidar no final do projeto)

### Sprint 1 — `Relatorio Final - Sprint 1.docx` (5 lacunas)

Praticamente pronto. Restam:

- [ ] Métricas quantitativas: número de commits, número de PRs, linhas de código por integrante, tempo médio de revisão
- [ ] Percepções individuais de cada integrante (opcional — uma seção de retrospectiva por pessoa)

### Sprint 2 — `Relatorio Final - Sprint 2.docx` (25 lacunas)

Toda a sprint pendente. Preencher conforme execução:

- [ ] H5 — modelos efetivamente escolhidos por estágio (MODEL_CLASSIFY, MODEL_SYNTHESIZE, MODEL_COMPRESS_*, MODEL_JUDGE), parâmetros (temperatura, top-p, max tokens) e justificativas
- [ ] H5 — implementação do chunking (T24) e limites de tamanho adotados
- [ ] H5/T26 — resultados do teste com ≥ 50 docs: taxa de acerto da classificação, taxa de aprovação da validação, custo médio por doc, latência p50 e p95
- [ ] H6 — passo a passo da configuração do Google Cloud Console, OAuth Client ID, URLs de callback
- [ ] H6/T30 — resultado do teste com conta real
- [ ] H7 — textos finais dos ≥ 8 prompts oficiais
- [ ] H7 — screenshots da tela `/prompts` e exemplos de prompts personalizados gerados
- [ ] Resultados — taxa final de conclusão, métricas de qualidade do pipeline, métricas do Drive e da biblioteca
- [ ] Resultados — gráficos comparativos de custo/latência por modelo (caso tenha tido A/B test)
- [ ] Dificuldades — custo de chamadas LLM, classificação ambígua, docs longos, cotas de API, OAuth Google, prompts oficiais
- [ ] Aprendizados — prompt engineering, decisões arquiteturais reavaliadas, ajustes pra Sprint 3
- [ ] Considerações finais — status real, pendências transferidas, riscos identificados

### Sprint 3 — `Relatorio Final - Sprint 3.docx` (22 lacunas)

Toda a sprint pendente. Preencher conforme execução:

- [ ] H8 — ajustes de integração, estados de loading revisados, optimistic updates, matriz de browsers/dispositivos testada
- [ ] H8 — testes em condições adversas: 3G simulado, falhas de rede, desconexão durante upload
- [ ] H9 — roteiro completo das sessões de teste
- [ ] H9 — critérios de recrutamento e perfil demográfico dos 10+ participantes (curso, semestre, gênero, familiaridade prévia com IA)
- [ ] H9 — link do formulário Google Forms/Typeform de coleta de feedback
- [ ] H9 — protocolo de consentimento informado (TCLE)
- [ ] H9/T42 — lista consolidada de bugs por severidade (crítico/alto/médio/baixo)
- [ ] Resultados — métricas das sessões: tempo total, tempo por etapa, taxa de erro, número de tentativas, taxa de abandono
- [ ] Resultados — pontuação SUS média, intervalo de confiança, classificação Bangor-Kortum-Miller
- [ ] Resultados — TAM (Perceived Usefulness e Perceived Ease of Use)
- [ ] Resultados — análise qualitativa (Bardin): elogios, dificuldades, sugestões, comparações
- [ ] Dificuldades — recrutamento, agendamento, bugs em uso real, infraestrutura sob carga, custos LLM em teste
- [ ] Aprendizados — ajustes de prompt motivados por uso real, melhorias de UX, hipóteses validadas/refutadas
- [ ] Considerações finais — taxa de conclusão, bugs transferidos para Sprint 4, prioridades

### Sprint 4 — `Relatorio Final - Sprint 4.docx` (26 lacunas)

Toda a sprint pendente. Preencher conforme execução:

- [ ] H10/T43 — planilha consolidada dos dados dos formulários
- [ ] H10/T44 — gráficos: distribuição SUS, médias por dimensão TAM, frequência de temas qualitativos
- [ ] H10/T45 — relatório consolidado de QA
- [ ] H11 — resumo do artigo (≤ 250 palavras conforme ABEPRO)
- [ ] H11 — palavras-chave (3 a 5)
- [ ] H11 — versão final do PDF (8 a 14 páginas)
- [ ] H11 — registro do processo de revisão por pares interna, ajustes do orientador, versão protocolada para submissão ENEGEP
- [ ] H12 — estrutura final dos slides (lista de seções)
- [ ] H12 — roteiro da demo ao vivo (passo a passo)
- [ ] H12 — resultado dos ensaios (tempo médio, ajustes aplicados)
- [ ] H12/T54 — composição do pacote final de entrega (lista de arquivos à coordenação)
- [ ] Resultados — síntese final: total de docs processados, total de alunos atendidos, distribuição por matéria, SUS final, TAM final, comparativo com ferramentas similares
- [ ] Resultados — discussão à luz da revisão bibliográfica, contribuições originais, limitações reconhecidas

### Relatório Final do Projeto — `Entregas/Relatorio Final do Projeto.docx`

Documento consolidado das 4 sprints, em ABNT NBR 14724 (estrutura mais completa: inclui Resumo, Abstract, Lista de figuras/tabelas, Fundamentação teórica, Apêndices). Lacunas adicionais específicas deste documento:

- [ ] Resumo (em português, 150-250 palavras, com palavras-chave)
- [ ] Abstract (versão em inglês do resumo)
- [ ] Lista de figuras (capturas de tela, diagramas, gráficos finais inseridos)
- [ ] Lista de tabelas (tabelas inseridas com numeração ABNT)
- [ ] Diagrama de arquitetura atualizado (substituir referência por figura embarcada)
- [ ] Diagrama ER das 8 tabelas
- [ ] Diagrama de sequência do pipeline assíncrono
- [ ] Métricas globais consolidadas (commits, PRs, issues, cobertura de testes, LOC, distribuição de contribuição por integrante)
- [ ] Análise de cumprimento de cronograma vs. planejamento inicial das 4 sprints
- [ ] Lições aprendidas em 3 dimensões: técnica, processo, pessoal
- [ ] Trabalhos futuros e plano de continuidade do produto fora da disciplina
- [ ] Apêndices: roteiro de testes, TCLE, código relevante, prompts oficiais, capturas de tela

---

## 📊 Resumo numérico (atualizado 26/05/2026)

| Status | Tarefas |
|---|---|
| ✅ Concluídas (código + doc) | **22** |
| 📄 Documentadas, código pendente | 0 |
| 🔴 Não documentadas, não implementadas | 0 |
| ⏸️ Sprint 2 pendentes (operacionais) | **2** (T26, T30) |
| ⏸️ Sprint 3 pendente | 8 |
| ⏸️ Sprint 4 pendente | 12 |
| **TOTAL pendentes** | **22 de 54** |
| **% concluído** | **~59%** |

---

## 🎯 Sugestão de próximos passos (priorizado)

1. **Aplicar migrations 0003, 0004, 0005 no Supabase real** (`supabase db push`)
2. **Configurar OpenRouter + GCP OAuth** (desbloqueia T26 e T30)
3. **Habilitar botão Google no LoginPage** + handler de `connect-drive` (~2h)
4. **T30** (testar Drive real) — depois do GCP, ~30 min
5. **T26** (validar 50 docs) — depois do OpenRouter, ~2-3h
6. **Sprint 3 — H8 (Integração e polish)** — começar depois do pipeline rodar de ponta a ponta

---

## 🧪 Validação local da entrega (sessão 26/05/2026)

```bash
# Roda todos os 140 testes com coverage (não consome créditos LLM)
npm test -- --coverage

# Gera os 9 docs de entrega .docx
node tools/deliverable-docs/build.mjs

# Typecheck + build
npm run typecheck
npm run build
```

Todos esses passos devem terminar em verde sem erro.

---

## 🔍 Auditoria 2026-05-26 — pendências do que NÃO foi auto-corrigido

> Origem: pacote completo em `Entregas/Auditoria-2026-05-26/` (6 relatórios + `RESUMO-EXECUTIVO.md` + `QUICKWINS.md`).
> A auditoria identificou ~96 achados em 6 frentes. Desta sessão, **24 itens foram auto-corrigidos** (29 commits — mapa completo em `RESUMO-EXECUTIVO.md` §7 e §8). O que falta está agrupado abaixo por categoria de bloqueio.

### A) 🔴 Decisões de produto / arquitetura — só você decide

| ID | Achado | Frente | Esforço | O que precisa ser decidido |
|---|---|---|---|---|
| A2 bugs | Status `needs_review` declarado mas pipeline nunca atribui | Bugs | 2h | Pipeline pausa o job (espera revisão UI) ou completa com flag visível? |
| A4 bugs | `compressed_cola` declarado mas pipeline só gera `compacta` | Bugs | 1h + $ | Gerar segunda compressão **dobra custo LLM por job** — autorizar? Ou flag por preferência do aluno? |
| S-01 / A4 banco | Tokens Google em texto plano em `profiles.google_*` | Segurança / Banco | 4–6h | pgsodium (Vault), `crypto.subtle` app-side, ou aceitar dívida documentada? |
| A2 banco | `documents.materia_code` é `text` solto, sem FK pra `subjects` | Banco | 4h | Criar tabela `subjects(user_id, code, nome)` ou aceitar `jsonb` `profiles.materias`? |
| A3 banco | `user_system_prompts.source_documents uuid[]` denormalizado | Banco | 2h | Tabela de junção `user_system_prompt_sources` ou aceitar `uuid[]`? |
| D1 bugs | `curso` opcional no `ProfileFormSchema` vs onboarding pede só semestre | Bugs | 1h | Tornar obrigatório (mudança de produto) ou só ajustar copy? |
| C7 bugs | `recordConsent` fire-and-forget no LoginPage | Bugs | 1h | Registrar via trigger DB em `handle_new_user` ou retry com backoff? (LGPD) |
| S-03 paliativo | Limite de custo diário por usuário (`profiles.max_cost_usd_per_day`) | Segurança | 2h | Default razoável? $0,50/dia? Schema change. |

### B) 🔴 Acesso a infra fora do escopo do código

| Achado | O que falta |
|---|---|
| S-10 | Confirmar via `mcp__supabase list_migrations` que **0005_seed_prompt_library** e **0007_archive_documents** estão aplicadas em prod. As outras (0003, 0004, 0006, 0007_schema_cleanup, 0008, 0009, 0010, 0011) já estão — verificado em 2026-05-26. |
| S-12 | `supabase secrets set ALLOWED_ORIGINS="https://psp2-ia-universitarios.vercel.app"` no projeto. |
| F3 banco | Documentar plano de backup/restore (`docs/BACKUP.md`): plano Supabase, comando de `pg_dump`, onde guarda, runbook de restore. |
| Advisor security | 8 funções `admin_*` aparecem como "executable by authenticated" no advisor. Decisão: aceitar (cada RPC checa `is_admin()` internamente — defesa em profundidade ativa em `0010`) ou revogar `EXECUTE` de `authenticated`? Recomendado: aceitar. |
| Advisor auth | "Leaked Password Protection" desabilitado no dashboard → habilitar em Auth → Settings → Password Strength. |

### C) 🟡 Frontend grande — Pedro

| Achado | Descrição | Esforço |
|---|---|---|
| B2 bugs | UI Conectar Drive em `SettingsPage` + handler `signInWithOAuth(google)` + POST `connect-drive` | 6h |
| B3 bugs | Página `/meu-prompt` consumindo `generate-system-prompt` + botão Regenerar + Copiar | 6h |
| E1 bugs | Widget de feedback (rating + tópico + comentário) inserindo em `feedback` | 4h |
| C1 bugs | `staleTime` + `onError` em `useProfile`, `usePromptLibrary` (já feito em `useJobs`) | 1h |
| S-02 | Frontend parsea JSON de erro da Edge Function, mostra mensagem amigável | 1h |
| F-01 testes | Frontend tem **zero testes** — instalar `@testing-library/react`+`jsdom`, escrever smoke de `LoginPage`, `UploadDropzone`, `JobCard`, `DashboardPage`, `RequireAuth` | 15h |

### D) 🟡 Backend / Edge Functions — Isaac

| Achado | Descrição | Esforço |
|---|---|---|
| OBS-A2 | `request_id` ponta-a-ponta: UUID no frontend, propaga via header `X-Request-Id`, persiste em `jobs.request_id`+`job_events.request_id`, ecoa em body de erro. **Precisa migration 0012**. | 6h |
| OBS-A4 | Adotar `createLogger` (helper já em `_shared/log.ts`) nas 4 Edge Functions | 4h |
| OBS-A5 | Instrumentar wrapper OpenRouter com logs de start/end (model, latency, tokens, cost) — base já com `onRetry` | 2h |
| A6 bugs | RPC `create_document_with_job` transacional + ajustar `ingest-document` | 2h |
| A7 bugs | Watchdog `pg_cron` pra jobs presos > 10min (pattern documentado em `CLAUDE.md`) | 4h |
| F-02 testes | Testes de contrato dos 4 handlers Edge Functions (920 LoC sem teste) | 15h |
| F-03 testes | Teste E2E happy-path do pipeline com fetch stub determinístico | 8h |
| S-06 | Wrapper `logError(ctx, err)` filtrando `details`/`hint` do PostgrestError, aplicado nos 4 handlers | 2h |
| S-04 (cont.) | Confirmar `materia_code` contra lista real do profile + hash do conteúdo bruto pra detectar regenerações suspeitas | 2h |
| S-03 definitivo | Rate limit distribuído via Upstash Redis (substituir Map in-memory) | 6h |
| S-09 | `deno.lock` versionado + `deno task check` no CI | 2h |
| OBS-A7 | Painel ops: `tools/ops/errors-last-24h.sql` + `tools/ops/failed-jobs.sql` + (opcional) rota `/admin` web | 3h SQL + 12h UI |

### E) 🟡 QA — Luis Felipe + Theo

| Achado | Descrição | Esforço |
|---|---|---|
| F-09 | `docs/QA/smoke-checklist.md` versionado com matriz feature × passo × resultado | 3h |
| F-04 | Cobrir `cors.ts`, `http.ts`, `rate-limit.ts`, `vision/*` com testes (~1013 LoC) | 6h |
| F-12 | `coverage.thresholds` em `vitest.config.ts` (lines>=70, statements>=70, functions>=60) depois de medir baseline | 1h |
| S-13 | Smoke test pós-deploy validando chain `ingest → process` | 3h |
| F-11 | `noUncheckedIndexedAccess: true` em `tsconfig.base.json` + corrigir fallout | 1h+ |

### F) 🟡 DX — decisão de processo

| Achado | Descrição |
|---|---|
| F-07 | Prettier + script `format` + check no CI (alinhamento de estilo entre 5 devs) |
| F-08 | Husky + lint-staged (pré-commit que roda lint + typecheck em arquivos staged) |
| E3 banco | Consolidar instruções repetidas de aplicação de migration num `supabase/migrations/README.md` |
| A6 cod morto | Deletar branch remota `feature/sprint1-pipeline` (`git push origin --delete feature/sprint1-pipeline`) — já mergeada em main, ruído no `git branch -a` |
| A7 cod morto | Decidir destino do branch `dev`: descontinuar (trunk-based atual) ou reativar GitFlow? |
| F-13 follow-up | Cobertura visível no README ou em badge separada quando F-12 fixar threshold |

### G) Itens já endereçados nesta sessão (29 commits)

Mapa completo em `Entregas/Auditoria-2026-05-26/RESUMO-EXECUTIVO.md` §7 e §8. Resumo por categoria:

- **DB / migrations**: 0007_schema_cleanup (CHECK + índice + comments SQL) ✓ aplicada em prod · 0011_advisor_fixes (FK index + policy consolidation) ✓ aplicada em prod
- **Pipeline crítico**: claim atômico anti-double-execution, `started_at` não-regressivo, `validateJudge` wirado, `attempt_count++` no fail, prompt injection sandbox, guard markdown > 1MB, Zod body em process-document
- **Observabilidade**: ErrorBoundary global + handlers window, helper `_shared/log.ts`, `onRetry` callback + wiring em `job_events`, badge CI no README
- **Segurança**: whitelist `extension`, `verify_jwt = true` explícito por função em `config.toml`, CORS retorna `''` em origin não-whitelisted
- **Frontend**: `getSession()` antes do upload, `lastStatusRef` cap, Realtime filter `user_id=eq`, MarkdownPreview migrado pra `useQuery`+AbortSignal
- **Higiene**: deleta vision dead code (-182 linhas), remove devDeps órfãs (Tailwind/PostCSS/Autoprefixer), tipos órfãos pra `types.internal.ts`
- **CI/CD**: `--coverage` no test + upload artifact, `deploy-functions` com `needs: validate` gate, `@vitest/coverage-v8` em devDeps
- **Docs**: `CLAUDE.md` criado (logs/segurança/estilo/pg_cron roadmap), TODO em `SLO`
