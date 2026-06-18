# 🔄 Backlog Reformulado — PROPOSTA (CONFIRMADA — 18/06/2026)

> **Decisões confirmadas pelo PM:**
> - **D1 — Datas estritamente sequenciais:** S3 26/05→04/06 · S4 05/06→14/06 · S5 15/06→25/06.
> - **D2 — Testes com usuários (antigos H9/H10) → trabalho extra/futuro** (fora do backlog). Sprint 5 fica com H21–H24, **11 tarefas (T59–T69)** — sem o T70 de validação.
> - **D3 — 1 doc por tarefa (35 docs)**, fiel aos modelos existentes.
> - **D4 — Regenerar tudo**, reaproveitando conteúdo pertinente dos artefatos antigos (artigo + relatórios), e aposentando a estrutura antiga das Sprints 3/4.

> **Status:** base para geração. As §2/§3/§5 abaixo já refletem as decisões.
> Ao confirmar (ou ajustar) esta proposta, gero: (1) o backlog oficial atualizado,
> (2) um documento `.docx` por tarefa nas novas sprints, no mesmo padrão dos atuais,
> e (3) atualizo cronograma, relatórios, artigo e contexto conforme a §6.
>
> **Princípios desta reformulação:**
> 1. **Deadline final preservado:** 25/06/2026.
> 2. **Retroativa e fiel aos fatos:** as sprints 3/4/5 descrevem o que de fato foi
>    feito após o fim da Sprint 2 (25/05/2026), com rastreio por commit.
> 3. **Formato preservado:** mesmas colunas do backlog atual
>    (Sprint · Épico · História · Critérios · Responsável · Tarefas · Início · Término · Status · Poker · Bloqueio · Observação)
>    e mesmo padrão dos docs de tarefa (`📖 Em palavras simples` → seções 1–6).
> 4. **Troca pedida:** as antigas **Sprint 3** (Integração e Testes + Testes com Usuários) e
>    **Sprint 4** (Consolidação de feedback + Artigo + Apresentação) saem; entram **3 novas**:
>    - **Sprint 3 — Hardening completo do sistema** (amplo e geral)
>    - **Sprint 4 — Elaboração e finalização do artigo**
>    - **Sprint 5 — Jornada do cliente**

---

## 1. Mapa de entendimento cronológico (pós-Sprint 2)

Reconstruído a partir de **72 commits** (25/05 → 16/06/2026), das **auditorias**
(`Entregas/Auditoria-2026-05-26/27/28` e `Entregas/Auditoria-2026-06-10`), de
`docs/PENDENCIAS.md`, `docs/EXTRAS.md` e `docs/visao-futuro.md`. Os commits citam
explicitamente o achado/auditoria de origem, então o rastreio é direto.

| Onda | Período | Natureza do trabalho | Vira… |
|---|---|---|---|
| **Fim Sprint 2** | até 25/05 | Geração de prompts (H7), Drive (H6 código), chunking (T24) | Sprint 2 (status → Concluído) |
| **Onda 1 — Auditoria 05-26/27/28** | 26/05–29/05 | 6 frentes, ~96 achados. Fixes: claim atômico, sandbox prompt-injection, CORS strict, Zod, `validateJudge`, ErrorBoundary, logger estruturado, dead-code cleanup, migrations 0007/0011, CI coverage + deploy gate | **Sprint 3 (Hardening)** |
| **Onda 2 — Build do produto** | 29/05–01/06 | Identidade UnB, onboarding, LGPD, dashboard, /atividade, /admin, /materias + SIGAA, /prompts, feedback (H10), system prompt (H7), logger frontend, activity_logs | **Sprint 5 (Jornada do cliente)** |
| **Onda 3 — Auditoria 06-10** | 10/06–11/06 | 104 achados (1 crítico: escalada admin). Migrations 0020-0029, blindagem de tokens Google, finish_reason, timeout LLM, requeue, a11y WCAG, responsividade + tema escuro | **Sprint 3 (Hardening)** + a11y/journey |
| **Onda 4 — Polimento e integração** | 11/06–16/06 | Conexão Drive na UI, status de providers + catálogo de modelos no /admin, upload idempotente no Drive, cost guard por chamada, merges para `dev` | **Sprint 3 + Sprint 5** |
| **Artigo** | 29/05 (corpo) + 11/06 (ajustes) | Corpo ENEGEP (seções 1–7, 14 págs), capa, 26 refs ABNT; números da Seção 5 ainda a validar com dados reais | **Sprint 4 (Artigo)** |

**Observação-chave:** hardening (Sprint 3) e jornada do cliente (Sprint 5) ocorreram
**em paralelo** (duas ondas cada), exatamente como as Sprints 1 e 2 originais já se
sobrepunham. O artigo é a faixa final, batendo no deadline.

---

## 2. Datas propostas (retroativas, deadline 25/06)

| Sprint | Tema | Início | Término |
|---|---|---|---|
| Sprint 3 | Hardening completo | **26/05/2026** | **04/06/2026** |
| Sprint 4 | Elaboração e finalização do artigo | **05/06/2026** | **14/06/2026** |
| Sprint 5 | Jornada do cliente | **15/06/2026** | **25/06/2026** |

> Esquema **estritamente sequencial** (decisão D1). Todas dentro do deadline 25/06.

**Sprints 1 e 2 (retroativo):** apenas atualizar `Status` para **Concluído** e alinhar
datas ao cronograma ajustado (Sprint 1 ~09/04–02/05; Sprint 2 ~20/04–25/05). Conteúdo
inalterado.

---

## 3. Backlog reformulado — Sprints 3, 4 e 5

Numeração de tarefas **continua de onde parou** (última usada: T34) → novas começam em **T35**.
Equipe: **Theo** (PM/dev/infra), **Isaac** (backend/DB), **Guilherme** (LLM/prompts),
**Pedro** (frontend), **Luis Felipe** (QA).

### 🛡️ SPRINT 3 — Hardening completo do sistema (26/05 → 14/06)

**Meta da sprint:** levar o sistema de "funciona em happy-path" para "seguro, observável,
acessível e operável sob carga real", endereçando as duas auditorias completas.

| Épico | História | Tarefa (resumo) | ID | Resp. | Poker | Origem (commits) |
|---|---|---|---|---|---|---|
| **Segurança de acesso e dados** | H13 — Blindar privilégios e dados sensíveis no banco | Trigger anti-escalada de admin + blindagem de colunas `google_*`/`is_admin` + `app_settings` admin-only (0020–0022) | T35 | Isaac | 5 | 3f31d5b |
| | | Hardening de RLS + storage policies (0023) + reduzir uso de `service_role` (RLS no lugar) | T36 | Isaac | 5 | 3f31d5b, 5a0efac |
| | | Auditoria admin server-side anti-forja (0024) + RPC de requeue auditável (0025) + demote de admins falsos (0026) | T37 | Isaac | 3 | 3f31d5b |
| **Defesa do pipeline LLM** | H14 — Sandbox e contenção contra injeção/abuso | Sandbox `<<DOC>>` nas 3 etapas + judge + system prompt do aluno | T38 | Guilherme | 5 | 2e0f7d7, 5a0efac |
| | | Guards de custo/abuso: markdown > 1 MB, whitelist de extensões, payload sem Content-Length (411), teto de tokens de saída, cost guard por chamada | T39 | Isaac | 3 | c496797, b811ecf, 5a0efac, d68c321 |
| | | Rate limit por usuário + `authorizeProcessDocument` + CORS strict + `verify_jwt` explícito por função | T40 | Isaac | 5 | 1f780cf, 4ffcdff, abe11bd, 33a6d91 |
| **Robustez do pipeline e banco** | H15 — Resiliência a races, retries e falhas parciais | Claim atômico de job + `started_at` não-regressivo + `attempt_count++` + requeue de `failed` | T41 | Isaac | 5 | 2e27501, e5908f0, 5a0efac |
| | | `finish_reason='length'` tratado + timeout LLM (AbortSignal) + validação de compressão + `needs_review` | T42 | Guilherme | 5 | 5a0efac, 97a1ec2 |
| | | Migrations de schema/índices/advisors (0007, 0011, 0027) + correção grade `UNB_TURNOS` (tarde) + parser SIGAA multi-turno | T43 | Isaac | 5 | f029f61, c70a504, 3f31d5b, 61e68be |
| | | Retenção de `activity_logs` via pg_cron (0028) + roadmap operacional (watchdog/refresh/limpeza) | T44 | Isaac | 2 | 3f31d5b, 430b64b |
| **Observabilidade** | H16 — Logs estruturados, duráveis e sem PII | Logger JSON com redaction de PII (helper backend + frontend) + adoção nas 5 Edge Functions + separação dev/prod | T45 | Theo | 8 | c5e04ca, 25a2eaf, fb5feee, f526a73 |
| | | Persistência durável em `activity_logs` + `request_id` de correlação | T46 | Theo | 3 | 1742c57 |
| | | ErrorBoundary global + telemetria de retry em `job_events` + status de providers/catálogo de modelos no /admin | T47 | Theo/Pedro | 5 | 23f7046, d63c3eb, 74cb07a, 41d287d |
| **Acessibilidade e responsividade** | H17 — WCAG 2.1 AA + multi-tela | A11y: foco global (azul+halo), focus trap em modais, `aria-live` em toasts, `document.title` por rota, skip-link, `aria-invalid`, contraste AA, markdown renderizado | T48 | Pedro | 8 | c216a5b |
| | | UI responsiva mobile-first (topbar hambúrguer, grids fluidos) + tema claro/escuro | T49 | Pedro | 5 | ea475eb |
| **Qualidade, CI/CD e higiene** | H18 — Pipeline de entrega confiável | CI/CD endurecido: coverage, gate `validate` antes do deploy, job `migrate`, ESLint flat v9, Dependabot, CodeQL, `npm audit` + headers/CSP estritos no Vercel | T50 | Theo | 5 | 514841e, ba413b4, 866e9d9, 33a6d91 |
| | | Cleanup técnico: dead code (vision/tipos órfãos), devDeps órfãs (Tailwind/PostCSS), formatadores unificados, README real, export CSV alinhado ao LGPD | T51 | Isaac/Theo | 3 | 522c039, ab9412f, 67a9fb1, c216a5b, 118cc71 |
| | | Auditorias completas do sistema como prática de QA (4 rodadas, ~200 achados, 6 frentes) | T52 | Theo | 5 | a49e0c5, 23acd63 |

**18 tarefas (T35–T52).** Critérios de aceitação por história resumidos no doc de cada tarefa.

### 📝 SPRINT 4 — Elaboração e finalização do artigo (15/06 → 25/06)

**Meta:** fechar o artigo ENEGEP 2026 pronto para submissão (8–14 págs, ABNT NBR 14724:2024).
*Corpo já redigido (seções 1–7); esta sprint formaliza e finaliza.*

| Épico | História | Tarefa (resumo) | ID | Resp. | Poker |
|---|---|---|---|---|---|
| **Redação do artigo** | H19 — Redigir corpo do artigo | Introdução, problema, justificativa e objetivos SMART | T53 | Theo | 5 |
| | | Revisão bibliográfica + Metodologia (DSRM) e arquitetura | T54 | Isaac | 5 |
| | | Desenvolvimento do artefato + Resultados e discussão | T55 | Guilherme/Luis Felipe | 5 |
| | | Considerações finais e trabalhos futuros | T56 | Guilherme | 3 |
| **Finalização e submissão** | H20 — Fechar para submissão | Capa, resumo (~250 palavras), palavras-chave, 26 referências ABNT (+ 2–3 brasileiras) | T57 | Theo | 3 |
| | | Validar números da Seção 5, revisão por pares interna, formatação ABNT, PDF anonimizado + pacote de submissão | T58 | Theo | 5 |

**6 tarefas (T53–T58).** Reaproveita os 5 docs de artigo já existentes (antiga Sprint 4) — ver decisão D3.

### 🧭 SPRINT 5 — Jornada do cliente (26/05 → 25/06)

**Meta:** entregar e validar a jornada completa do aluno — da aquisição ao hábito de uso —
com a identidade UnB e base LGPD.

| Épico | História | Tarefa (resumo) | ID | Resp. | Poker | Origem |
|---|---|---|---|---|---|---|
| **Aquisição e onboarding** | H21 — Entrada do aluno | Login/cadastro + magic link + força de senha + identidade visual UnB (paleta, logo, redesign) | T59 | Pedro | 5 | f2617ed |
| | | Consentimento LGPD no signup + páginas Privacidade/Termos + página 404 | T60 | Pedro | 3 | f2617ed |
| | | Onboarding guiado 4-step (curso, semestre, matérias, horários) | T61 | Pedro | 5 | f2617ed |
| **Perfil acadêmico** | H22 — Configurar o semestre | Página /materias com grade visual + import SIGAA (parser shared + Edge Function) | T62 | Pedro/Isaac | 8 | bef65ab, 29dba00, 7670453 |
| | | Conexão Google Drive nas configurações (OAuth + estados) | T63 | Pedro | 3 | c7ab6e3 |
| **Núcleo de uso diário** | H23 — Processar, acompanhar, gerir | Dashboard com métricas pessoais, filtros e atualização em tempo real | T64 | Pedro | 5 | 7670453 |
| | | Gestão de documentos: arquivar/excluir + preview de síntese (markdown renderizado) | T65 | Pedro | 5 | 7670453, c216a5b |
| | | Página /atividade — transparência operacional (eventos por etapa) | T66 | Pedro | 3 | 7670453 |
| **Personalização e voz do cliente** | H24 — Reter e ouvir | Biblioteca de prompts + system prompt personalizado injetado na síntese | T67 | Guilherme/Pedro | 5 | cb99fc4, ab438c8 |
| | | Feedback widget no preview + painel /admin/feedback | T68 | Pedro | 5 | cb99fc4 |
| | | Privacidade self-service (export/delete) + filtro de dados de teste no /admin | T69 | Theo | 3 | 2855d3d |

**11 tarefas (T59–T69).** A validação por testes com usuários (antigos H9/H10) saiu do backlog → **trabalho extra/futuro** (§4).

> **Total de docs de tarefa a gerar:** 18 (S3) + 6 (S4) + 11 (S5) = **35**.

---

## 4. Trabalho extra (fora do escopo direto das 3 sprints)

Itens **feitos e relevantes** que não encaixam como tarefa de sprint, ou que são pesquisa/
processo/arquitetura além do planejado. Consolidado de `docs/EXTRAS.md` (30 categorias):

1. **Metodologia de auditoria com múltiplos agentes IA em paralelo** (6 frentes simultâneas) — inovação de processo de QA.
2. **Arquitetura multi-provider de LLM** — vision provider abstrato, modelos dinâmicos por estágio, `app_settings` editável em runtime, roteamento nativo por provider.
3. **Versões múltiplas de conteúdo** (`generated_content`: synthesized / compressed_compact / compressed_cola) e modos "compacta"/"cola".
4. **`visao-futuro.md`** — norte estratégico (13 seções, trilhas médio/longo prazo) → alimenta "Trabalhos futuros" do artigo e a evolução da jornada.
5. **`CLAUDE.md`** — convenções de log/segurança/estilo/UI/responsividade/tema para agentes IA.
6. **GitHub Actions, Dependabot, CodeQL, deploy automatizado** de Edge Functions.

**Não realizado (pendências/futuro, não é trabalho feito):**
- **T26 antigo** — teste do pipeline com ≥ 50 docs reais (bloqueado por deploy/secrets).
- **T30 antigo** — teste do fluxo Drive com conta real (bloqueado por config GCP).
- **Testes com usuários reais** (antigos H9/H10) — não executados; ficam como **trabalho extra/futuro**, fora do backlog (decisão D2).
- **Deploy de produção** (Supabase real, OpenRouter, GCP OAuth, Vercel) — pendente.

> Sugiro manter o `docs/EXTRAS.md` como registro canônico e cruzá-lo no relatório de cada sprint.

---

## 5. Decisões a confirmar

- **D1 — Datas:** usar o esquema **sobreposto/fiel** (§2, Sprint 3 e 5 em paralelo) ou **estritamente sequencial** (S3: 26/05–04/06 · S4: 05/06–14/06 · S5: 15/06–25/06)?
- **D2 — Testes com usuários (antigos H9/H10):** entram na Sprint 5 como **tarefa planejada** (H25) + pendência, ou são empurrados inteiramente para **trabalho extra/futuro**?
- **D3 — Docs do artigo:** os 5 `.docx` já existentes em `Entregas/Sprint 4/.../H11` (S4T46–T50) são **reaproveitados/movidos** para a nova Sprint 4, ou gero novos por cima do padrão T53–T58?
- **D4 — Granularidade dos docs:** gerar **1 doc por tarefa (36 docs)** ou só os "headline" por história (menos docs, mais densos)?
- **D5 — Pastas das antigas Sprint 3/4:** as pastas atuais (`Sprint 3/Integração e Testes`, `Sprint 4/Testes com Usuários`, etc.) devem ser **substituídas** pela nova estrutura. Apago/renomeio ou mantenho as antigas como histórico?

---

## 6. Verificação e próximos passos (a executar após gerar os docs)

1. **Backlog oficial** — atualizar `Backlog do Produto (Oficial).xlsx` (Sprint 1/2 → Concluído; Sprint 3/4/5 novas) e `Cronograma Ajustado...xlsx`.
2. **Relatórios por sprint** — criar `Relatorio Final - Sprint 3/4/5.docx` no padrão ABNT existente; aposentar os relatórios das antigas 3/4. Preencher lacunas `[A PREENCHER]` com dados reais (commits, métricas).
3. **Artigo** — alinhar Seção 5 (números reais vs. plausíveis), seção de metodologia/arquitetura com o que foi de fato implementado, e "trabalhos futuros" com `visao-futuro.md`.
4. **Relatório geral** — `Relatorio Final do Projeto.docx`: refletir a nova estrutura de sprints e o cronograma retroativo.
5. **Contexto** — `docs/PENDENCIAS.md` (remapear sprints), `docs/EXTRAS.md`, `CLAUDE.md` (roadmap), `README.md` e a memória do projeto.
