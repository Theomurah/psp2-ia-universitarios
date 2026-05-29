# Schema do banco — PSP2

Documentação didática do schema `public` do Supabase do PSP2
(projeto `psp2-ia-universitarios`, ref `bthwkwgdbtrkixajvddi`).
Todas as tabelas têm **RLS habilitado** (Row Level Security): cada usuário
só enxerga as próprias linhas, exceto onde indicado.

> **Leitura desta doc:** cada seção começa com "**O que é**" (uma frase de
> contexto) e depois lista as colunas. A coluna "Descrição" explica o
> *porquê* do campo, não só o tipo.

---

## 1. `profiles`

**O que é:** ficha do usuário do app. Existe uma linha por conta de
`auth.users` (login Supabase). Guarda dados de onboarding (curso,
semestre, matérias) e as credenciais do Google Drive — que é onde o
aluno guarda os documentos sincronizados.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | Mesmo ID do `auth.users.id`. É como amarramos perfil ↔ conta de login. |
| `email` | `text` | Email do aluno. Vem do provedor de login (Google, magic link). |
| `full_name` | `text?` | Nome completo, preenchido no onboarding. |
| `curso` | `text?` | Curso na UnB (ex: `"Engenharia de Produção"`). Coletado no onboarding e usado pra contextualizar prompts. |
| `semestre_atual` | `text?` | Semestre que o aluno está cursando agora (ex: `"2026.1"`). Muda a cada semestre. |
| `materias` | `jsonb` | Lista das matérias do semestre. Formato: `[{ code, nome, profs?, horarios? }]`. É o "grade horária" do aluno — usado pra sugerir matéria ao classificar um doc. |
| `drive_root_folder_id` | `text?` | ID da pasta-raiz no Google Drive onde o app vai salvar e ler documentos. Definido na conexão inicial com o Drive. |
| `drive_connected_at` | `timestamptz?` | Quando o usuário conectou o Drive pela 1ª vez. Serve pra mostrar status na UI e medir adoção. |
| `google_refresh_token` | `text?` | Token OAuth2 de longa duração do Google. **Sensível** — nunca logar. Usado pra renovar o `google_access_token` sem pedir login de novo. |
| `google_access_token` | `text?` | Token de acesso ao Drive. Vida curta (~1h), renovado automaticamente. **Sensível**. |
| `google_token_expires_at` | `timestamptz?` | Momento em que o `google_access_token` expira. A Edge Function renova com 60s de margem antes. |
| `is_admin` | `boolean` | Flag de admin. `true` libera acesso ao painel `/admin` e políticas privilegiadas. Default `false`. |
| `created_at` | `timestamptz` | Quando o perfil foi criado (em geral, no 1º login). |
| `updated_at` | `timestamptz` | Última edição de qualquer campo. |

---

## 2. `documents`

**O que é:** cada documento que o aluno subiu (ou que o app puxou do
Drive). Esta tabela guarda metadados — o conteúdo binário fica no
Supabase Storage, e o texto/markdown extraído vai pra `generated_content`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID do documento. |
| `user_id` | `uuid` → `profiles.id` | Dono do documento. Base do RLS — cada um só vê os seus. |
| `filename_original` | `text` | Nome do arquivo como o aluno subiu (ex: `"aula3.pdf"`). |
| `filename_final` | `text?` | Nome renomeado pelo classificador (ex: `"FISICA3-Aula-03-Cinematica.pdf"`). Preenchido depois do pipeline. |
| `format` | `enum` | `pdf` \| `docx` \| `pptx` \| `md` \| `image`. Define qual parser usar. |
| `size_bytes` | `bigint` | Tamanho do arquivo em bytes. Usado pra quota e métricas. |
| `storage_path` | `text` | Caminho no Supabase Storage. Sempre prefixado com `user.id/...` (regra de segurança). |
| `drive_file_id` | `text?` | Se veio do Google Drive, ID do arquivo lá. Permite reabrir/baixar de novo. |
| `drive_folder_path` | `text?` | Pasta de origem dentro do Drive. Ajuda a inferir matéria/tipo. |
| `materia_code` | `text?` | Código da matéria (ex: `"FISICA3"`). Preenchido pelo classificador. |
| `tipo` | `enum?` | Categoria do documento: `Aula` \| `Plano` \| `Programa` \| `Cronograma` \| `Ficha` \| `Guia` \| `Resumo` \| `Resumão` \| `Questionário` \| `Estudo Dirigido` \| `Unidade` \| `Lista` \| `Apostila` \| `Cola` \| `Outro`. |
| `data_doc` | `date?` | Data do *conteúdo* do documento (ex: data da aula), não do upload. |
| `identificador` | `text?` | Identificador interno extraído (nº da aula, unidade, capítulo). |
| `titulo` | `text?` | Título extraído do documento. |
| `classificacao_confianca` | `numeric?` | Score 0–1 do classificador. Abaixo de um limiar, o job vai pra `needs_review`. |
| `created_at` | `timestamptz` | Momento do upload. |
| `processed_at` | `timestamptz?` | Momento em que o pipeline terminou de processar. NULL = ainda em processo ou falhou. |
| `archived_at` | `timestamptz?` | Soft delete. `NULL` = ativo. Reversível (basta setar `NULL` de novo). |

---

## 3. `jobs`

**O que é:** uma execução do pipeline assíncrono para *um* documento.
Quando o aluno sobe um arquivo, criamos um `document` + um `job`. O
job passa por várias etapas (parse → classify → synthesize → compress)
e seu estado fica visível na UI em tempo real (Supabase Realtime).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID do job. |
| `user_id` | `uuid` → `profiles.id` | Dono (mesmo do documento). |
| `document_id` | `uuid` → `documents.id` | Documento sendo processado. |
| `status` | `enum` | Onde o job está agora: `pending` (na fila) \| `processing` (rodando) \| `needs_review` (classificação incerta, aluno precisa confirmar) \| `completed` (ok) \| `completed_with_warning` (rodou, mas com algum problema não-bloqueante) \| `failed`. |
| `current_step` | `text?` | Nome do passo atual (ex: `"synthesize"`). Atualizado pela Edge Function. |
| `progress_percent` | `smallint` | 0 a 100. Mostrado na barra de progresso na UI. |
| `attempt_count` | `smallint` | Quantas vezes já tentamos rodar este job. Usado por retries automáticos. |
| `error_reason` | `text?` | Motivo legível da falha (preenchido só em `failed`). |
| `chars_input` | `integer?` | Caracteres do doc bruto (após parse). Métrica de carga. |
| `chars_synthesis` | `integer?` | Caracteres da síntese gerada. |
| `chars_compression` | `integer?` | Caracteres da compressão (versão curta). |
| `cost_usd_total` | `numeric` | Custo total deste job em USD (soma das chamadas LLM). |
| `started_at` | `timestamptz?` | Quando o processamento começou. |
| `completed_at` | `timestamptz?` | Quando terminou (com sucesso ou falha). |
| `created_at` | `timestamptz` | Momento da criação do job (entrada na fila). |

---

## 4. `job_events`

**O que é:** trilha detalhada de cada passo do pipeline. Para cada `job`,
geramos múltiplos eventos (`start`, `success`, `retry`, `warning`,
`error`). Serve pra debugar, medir latência e custo por etapa, e mostrar
timeline na UI.

> Inserts **apenas** via `service_role` (Edge Function). Usuário só lê,
> e a leitura é controlada por RLS via FK do job.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `bigint` (PK serial) | ID auto-incremental. |
| `job_id` | `uuid` → `jobs.id` | Job ao qual o evento pertence. |
| `step` | `text` | Nome do passo (`parse`, `classify`, `synthesize`, `compress`, `judge`…). |
| `event_type` | `enum` | `start` (início do passo) \| `success` (passo concluiu) \| `retry` (vai tentar de novo) \| `warning` (rodou mas com aviso) \| `error` (falhou). |
| `message` | `text?` | Mensagem livre — descrição do que aconteceu. |
| `duration_ms` | `integer?` | Quanto demorou em ms (preenchido nos `success`/`error`). |
| `llm_model` | `text?` | Se chamou LLM, qual modelo (ex: `"openai/gpt-4o-mini"`). |
| `tokens_input` | `integer?` | Tokens de entrada da chamada LLM. |
| `tokens_output` | `integer?` | Tokens de saída. |
| `cost_usd` | `numeric?` | Custo desta chamada específica. Soma destes alimenta `jobs.cost_usd_total`. |
| `created_at` | `timestamptz` | Quando o evento foi registrado. |

---

## 5. `generated_content`

**O que é:** o conteúdo produzido pelo LLM para um documento. Cada doc
pode ter várias linhas aqui — uma síntese e duas compressões (compacta
e cola).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID do conteúdo gerado. |
| `document_id` | `uuid` → `documents.id` | Documento de origem. |
| `type` | `enum` | `synthesized` (síntese completa) \| `compressed_compact` (versão resumida) \| `compressed_cola` (versão "cola" — bem curta, pra revisão rápida). |
| `markdown` | `text` | O texto em si, em formato Markdown. |
| `metadata` | `jsonb` | Extras: modelo usado, prompt aplicado, tokens, parâmetros. Default `{}`. |
| `validation_score` | `numeric?` | Nota 0–1 dada pelo "judge" LLM avaliando a qualidade. Usado pra detectar saídas ruins. |
| `created_at` | `timestamptz` | Quando foi gerado. |

---

## 6. `prompt_library`

**O que é:** biblioteca de prompts pré-prontos. Tem **prompts oficiais**
(curados pela equipe, `user_id = NULL`, `is_official = true`) que todos
veem, e **prompts do usuário** (`user_id = <aluno>`, privados).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID do prompt. |
| `user_id` | `uuid?` → `profiles.id` | Dono. `NULL` quer dizer prompt oficial (público para todos). |
| `title` | `text` | Título visível ao usuário. |
| `description` | `text?` | Descrição curta do que o prompt faz. |
| `template` | `text` | O texto do prompt em si, com placeholders. |
| `category` | `enum` | `estudo` \| `exercicio` \| `redacao` \| `revisao`. Usada nos filtros da UI. |
| `is_official` | `boolean` | `true` = curado pela equipe. Default `false`. |
| `usage_count` | `integer` | Quantas vezes foi usado. Métrica de popularidade. |
| `created_at` | `timestamptz` | Criação. |

---

## 7. `user_system_prompts`

**O que é:** o "system prompt" personalizado de cada aluno. É um texto
gerado a partir do perfil dele (matérias, semestre, docs principais)
que é injetado em todas as chamadas LLM pra contextualizar. **Versionado**
— quando o aluno muda de semestre, criamos uma nova versão.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID. |
| `user_id` | `uuid` → `profiles.id` | Dono. |
| `prompt_text` | `text` | O texto do system prompt em si. |
| `semester_snapshot` | `text` | Semestre vigente quando esta versão foi criada (ex: `"2026.1"`). |
| `source_documents` | `uuid[]` | IDs dos documentos que serviram de base pra gerar este prompt. |
| `version` | `integer` | Número da versão. Começa em 1, incrementa a cada regeneração. |
| `is_active` | `boolean` | `true` = é a versão em uso agora. Só uma por usuário. |
| `created_at` | `timestamptz` | Criação. |

---

## 8. `feedback`

**O que é:** avaliação do aluno sobre uma síntese específica ou sobre
o produto em geral. Nota de 1 a 5 + tópico + comentário opcional.
Insumo direto para melhoria de prompts e modelos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID. |
| `user_id` | `uuid` → `profiles.id` | Quem deu o feedback. |
| `job_id` | `uuid?` → `jobs.id` | Job avaliado. `NULL` = feedback geral do produto (não amarrado a um job). Se o job for deletado, vira `NULL` (preservamos o feedback). |
| `rating` | `smallint` | Nota de 1 a 5 (check constraint). |
| `topic` | `enum` | Sobre o quê é o feedback: `sintese` \| `nomenclatura` (renomeação automática) \| `drive` (integração) \| `prompts` \| `outro`. |
| `comments` | `text?` | Texto livre. |
| `created_at` | `timestamptz` | Envio. |

---

## 9. `user_consents`

**O que é:** registro LGPD dos aceites de política de privacidade e
termos de uso. Toda vez que o aluno aceita (ou re-aceita uma nova
versão), criamos uma linha. Para "revogar", **não deletamos** — setamos
`revoked_at`. Isso preserva a trilha de auditoria.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` (PK) | ID. |
| `user_id` | `uuid` → `profiles.id` | Quem aceitou. |
| `consent_type` | `text` | Tipo do aceite (ex: `"privacy_policy"`, `"terms_of_service"`). |
| `version` | `text` | Versão do documento aceito (ex: `"v1.2"`). Permite distinguir aceites de versões diferentes. |
| `accepted` | `boolean` | `true` (aceitou). Default `true`. |
| `given_at` | `timestamptz` | Quando o aceite foi dado. |
| `revoked_at` | `timestamptz?` | Se o usuário revogou depois, quando. `NULL` = ainda válido. |
| `ip` | `inet?` | IP de origem na hora do aceite. Evidência LGPD. |
| `user_agent` | `text?` | User agent do navegador. Evidência LGPD. |

---

## 10. `app_settings`

**O que é:** configurações do app editáveis em runtime (sem deploy).
Coisas como "qual modelo LLM usar pra síntese" ou "qual é o limite
de upload". Leitura aberta a qualquer usuário autenticado, mas
**escrita só via função `admin_set_setting()`** (impede que aluno
mexa direto).

| Coluna | Tipo | Descrição |
|---|---|---|
| `key` | `text` (PK) | Nome da config (ex: `"llm.synthesis.model"`). |
| `value` | `jsonb` | Valor — pode ser string, número, objeto. JSON pra flexibilidade. |
| `description` | `text?` | Descrição amigável do que essa config controla. Mostrada no `/admin`. |
| `updated_at` | `timestamptz` | Última alteração. |
| `updated_by` | `uuid?` → `profiles.id` | Qual admin alterou por último. Auditoria. |

---

## Relacionamentos (resumo visual)

```
auth.users ──1:1──► profiles
                       │
                       ├──1:N──► documents ──1:N──► generated_content
                       │             │
                       │             └──1:N──► jobs ──1:N──► job_events
                       │                         │
                       │                         └──1:N──► feedback
                       │
                       ├──1:N──► user_system_prompts
                       ├──1:N──► prompt_library  (linhas com user_id NULL = oficiais)
                       ├──1:N──► user_consents
                       └──1:N──► app_settings (via updated_by)
```

---

## Enums (catálogo)

| Enum | Valores |
|---|---|
| `document_format` | `pdf`, `docx`, `pptx`, `md`, `image` |
| `document_tipo` | `Aula`, `Plano`, `Programa`, `Cronograma`, `Ficha`, `Guia`, `Resumo`, `Resumão`, `Questionário`, `Estudo Dirigido`, `Unidade`, `Lista`, `Apostila`, `Cola`, `Outro` |
| `job_status` | `pending`, `processing`, `needs_review`, `completed`, `completed_with_warning`, `failed` |
| `job_event_type` | `start`, `success`, `retry`, `warning`, `error` |
| `generated_content_type` | `synthesized`, `compressed_compact`, `compressed_cola` |
| `prompt_category` | `estudo`, `exercicio`, `redacao`, `revisao` |
| `feedback_topic` | `sintese`, `nomenclatura`, `drive`, `prompts`, `outro` |
