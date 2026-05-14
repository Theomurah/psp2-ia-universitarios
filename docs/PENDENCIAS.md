# 📋 Pendências — PSP2 IA para Universitários

Lista viva do que ainda precisa ser feito pra fechar cada Sprint. Atualizada sempre que algo é entregue ou descoberto.

**Última atualização:** 14/05/2026
**Status geral:** Sprint 1 — 95% concluído (20 de 21 tarefas em código, 2 docs faltam)

---

## 🔴 Sprint 1 — Pendências (1 tarefa + sub-itens)

### T15 — Criar testes unitários por formato

- **Responsável:** Isaac
- **Planning Poker:** 3
- **Status:** Não implementado
- **Bloqueio principal:** Precisa do time rodar testes contra **docs reais variados**

**Sub-itens / etapas específicas:**

- [ ] Definir estrutura de testes: Vitest + nomenclatura por formato (`pdf.test.ts`, `docx.test.ts`, etc.)
- [ ] Criar pasta `supabase/functions/_shared/__tests__/`
- [ ] **PDF**: testar com 3 docs (uma aula bem-formatada, um livro com colunas, um PDF só de imagens — esse último deve gerar warning)
- [ ] **DOCX**: testar com docs do Theo (apostila Física 3, questionário SIEP)
- [ ] **PPTX**: testar com slides reais do TCM
- [ ] **MD**: testar com cabeçalho fixo + LaTeX preservado
- [ ] **Imagens**: testar com HEIC do iPhone + PNG de screenshot
- [ ] Mockar OpenRouter pra testar `parseImage` sem custo real
- [ ] CI: rodar testes no `validate.yml` antes do deploy

**Doc planejamento:** ainda não criada. Quando atacar a tarefa, criar `Entregas/Sprint 1/Desenvolvimento Backend/H3 - .../PSP2 - S1T15 - Testes Unitarios.docx`.

---

### T13 — Parsers por formato (sub-itens parciais)

A tarefa principal está concluída, mas alguns sub-aspectos ficaram em aberto:

- [ ] **Decisão sobre VISION_MODEL definitivo em produção** — atualmente trocável via env var, mas o time não decidiu se é Claude Sonnet, Gemini Flash ou outro
- [ ] **Pré-processamento de imagens** (otimização):
  - [ ] Auto-rotação baseada em metadata EXIF
  - [ ] Redução de resolução para 1024px máx (economia de tokens)
  - [ ] Compressão JPEG se > 5 MiB
- [ ] **OCR de slides PPTX exportados como imagens** — para decks sem texto, exportar slide-por-slide e rodar OCR

---

## 🟡 Sprint 2 — Pendências (toda a sprint)

### T24 — Lógica de chunking para docs grandes

- **Status:** Documentado em `Entregas/Sprint 2/.../PSP2 - S2T24 - Chunking para Documentos Grandes.docx` mas **não implementado**
- **Esforço estimado:** 2-3h de código + testes

**Sub-itens:**
- [ ] Criar `_shared/chunking.ts` com `Chunk`, `chunkDocument`, `slidingWindow`
- [ ] Implementar `synthesizeChunked` em `pipeline.ts`
- [ ] Adaptar `validateSemantic` pra modo chunked
- [ ] Atualizar `process-document` pra usar `synthesizeChunked` quando `chars > 50k`
- [ ] Testar com livros reais (Mankiw, apostila completa de Física)
- [ ] Adicionar logs por chunk em `job_events`
- [ ] Atualizar doc removendo aviso "NÃO IMPLEMENTADA"

### T26 — Testar pipeline com ≥ 50 docs-teste

- **Status:** Não iniciado
- **Bloqueio:** Precisa do pipeline rodando em ambiente real (Supabase + OpenRouter configurados)

**Sub-itens:**
- [ ] Coletar 50 docs reais do Theo (10 PDFs, 10 DOCX, 10 PPTX, 10 imagens, 10 MD)
- [ ] Rodar batch pela API (script standalone que faz upload em sequência)
- [ ] Computar métricas:
  - [ ] Taxa de acerto da classificação (matéria, tipo)
  - [ ] Taxa de aprovação da validação T11
  - [ ] Custo médio por doc
  - [ ] Latência p50 e p95
- [ ] Critério de aceitação: ≥ 80% de acerto
- [ ] Documentar resultados em `Entregas/Sprint 2/.../PSP2 - S2T26 - Teste 50 Docs.docx`

### H6 — Exportação para Google Drive (Sprint 2 inteira)

- **T27** — Configurar OAuth2 com Google Drive API
- **T28** — Criação automática de estrutura de pastas por matéria
- **T29** — Upload automático dos docs processados
- **T30** — Testar fluxo com conta real

**Sub-itens da H6:**
- [ ] Criar projeto no Google Cloud Console
- [ ] Criar OAuth Client ID com scopes `drive.file` (não `drive` full — princípio do menor privilégio)
- [ ] Configurar redirect URI: `https://{supabase}.co/auth/v1/callback`
- [ ] Adicionar Google como Provider no Supabase Auth
- [ ] Habilitar botão "Entrar com Google" no LoginPage (T17 — atualmente desabilitado)
- [ ] Implementar `_shared/drive/` com `findOrCreateFolder`, `uploadFile`, `listFiles`
- [ ] Wire-up no `process-document` (passo 10 — upload_drive)
- [ ] Criar pasta raiz `PSP2 - Estudos` no Drive do aluno (parte da Execução Extra da T07)
- [ ] Estrutura: `PSP2 - Estudos/{semestre}/{materia}/{arquivo}`
- [ ] Salvar `drive_file_id` e `drive_folder_path` em `documents`
- [ ] Testar com conta real do Theo

### H7 — Gerador de system prompt + biblioteca (Sprint 2)

- **T31** — Template base de system prompt parametrizável
- **T32** — Lógica de preenchimento automático com dados do aluno
- **T33** — Biblioteca de ≥ 8 prompts para tarefas comuns
- **T34** — Tela de visualização e cópia dos prompts

**Sub-itens:**
- [ ] Criar tabela `user_system_prompts` já existe — falta lógica de geração
- [ ] Template base: agrega `profile.materias`, `documents` recentes, system_prompt formatado
- [ ] Edge Function `generate-system-prompt` que monta o prompt a partir do perfil + últimos N docs
- [ ] Versioning: regenerar quando matérias/semestre mudarem (compara `semester_snapshot`)
- [ ] **Biblioteca de 8 prompts oficiais (`is_official=true`):**
  - [ ] "Resumir aula"
  - [ ] "Gerar lista de exercícios sobre tópico X"
  - [ ] "Explicar conceito como se eu fosse leigo"
  - [ ] "Quiz de revisão pra prova"
  - [ ] "Comparar 2 conceitos"
  - [ ] "Resolver exercício passo a passo"
  - [ ] "Fazer fichamento de capítulo"
  - [ ] "Estudo dirigido sobre [matéria]"
- [ ] Página `/prompts` no frontend com cards copiáveis (botão "Copiar")
- [ ] Página `/system-prompt` mostra o prompt personalizado atual com botão "Regenerar"

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
- [ ] **Aplicar migrations** no projeto criado (`0001_initial_schema.sql` + `0002_storage_bucket.sql`)
- [ ] **Conta OpenRouter** com créditos
- [ ] **Configurar secrets**: `OPENROUTER_API_KEY` (mínimo)
- [ ] **Adicionar secrets no GitHub** pro CI/CD: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
- [ ] **Primeiro deploy manual** das Edge Functions (`supabase functions deploy`)
- [ ] **Configurar Vercel** pra frontend (conectar repo + build settings)
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

## 📊 Resumo numérico

| Status | Tarefas |
|---|---|
| ✅ Concluídas (código + doc) | 13 |
| 📄 Documentadas, código pendente | 1 (T24) |
| 🔴 Não documentadas, não implementadas | 1 (T15) |
| ⏸️ Sprint 2 pendente | 13 |
| ⏸️ Sprint 3 pendente | 8 |
| ⏸️ Sprint 4 pendente | 12 |
| **TOTAL pendentes** | **34 de 54** |
| **% concluído** | **~37%** |

---

## 🎯 Sugestão de próximos passos (priorizado)

1. **Configurar Supabase real + OpenRouter** (desbloqueia testes de tudo)
2. **T15** (testes unitários) — Isaac, ~3h
3. **T24** (chunking) — Isaac, ~3h
4. **H6 (Drive Export)** — Isaac + Pedro, ~1 sprint
5. **H7 (Prompts)** — Guilherme + Theo + Pedro, ~1 sprint
6. **T26** (validação com 50 docs) — Theo, ~2h depois que tudo estiver no ar
