-- =============================================================================
-- PSP2 — Migration 0005
-- Biblioteca de 28 prompts oficiais (T33) — 7 por categoria.
-- =============================================================================
-- Popula prompt_library com prompts curados pelo time. Todos `is_official=true`
-- e `user_id IS NULL` (visíveis pra todos os alunos via RLS).
--
-- Distribuição (7 por categoria):
--   estudo     — resumir aula, explicar leigo, comparar conceitos, mapa mental,
--                glossário, Feynman reverso, conexões interdisciplinares
--   exercicio  — lista, resolver passo a passo, variações, identificar tipo,
--                corrigir resolução, hint socrático, template por tipo
--   redacao    — fichamento, outline, revisar, resenha, construir argumentação,
--                parafrasear sem plágio, citação ABNT
--   revisao    — quiz, estudo dirigido, flashcards, cheat sheet, simulado,
--                repetição espaçada, sabatina oral
--
-- Cada prompt usa placeholders {{var}} que o frontend substitui antes de copiar:
--   {{materia}}      — código curto (FISICA3) ou nome (Física 3)
--   {{topico}}       — tópico específico digitado pelo aluno
--   {{titulo_doc}}   — título de um documento processado
--   {{prova_data}}   — data da próxima prova (opcional)
--
-- Como aplicar: ver 0003_add_curso_horarios.sql (mesmo procedimento).
-- =============================================================================

-- Limpa duplicatas oficiais (idempotência — pode re-rodar a migration sem erro)
delete from public.prompt_library where is_official = true;

insert into public.prompt_library (user_id, title, description, template, category, is_official) values
(null,
 'Resumir aula',
 'Pede um resumo estruturado de uma aula com fórmulas, exemplos e erros comuns.',
 $pl$Resuma a aula "{{titulo_doc}}" de {{materia}} em Markdown estruturado.

Inclua:
1. **Conceitos centrais** em negrito.
2. **Fórmulas relevantes** em LaTeX (bloco $$...$$ ou inline $...$).
3. **Exemplo numérico** se a aula tiver.
4. **Erros comuns** ao aplicar os conceitos.
5. **Conexões** com aulas anteriores quando óbvio.

Não invente conteúdo que não estava na aula. Se algo não foi coberto, diga "[verificar com o professor]".$pl$,
 'estudo',
 true),

(null,
 'Lista de exercícios sobre {{topico}}',
 'Gera lista de 5-10 exercícios variados sobre um tópico.',
 $pl$Crie uma lista de 8 exercícios sobre {{topico}} em {{materia}}, variando dificuldade do mais simples ao mais complexo.

Para cada exercício:
- Enunciado claro.
- Dados em LaTeX quando aplicável.
- Espaço pra resolução do aluno (NÃO resolva — só o enunciado).
- Indicar a dificuldade: 🟢 fácil | 🟡 médio | 🔴 difícil.

No final, liste em **gabarito (separado)** as respostas numéricas finais (sem passos), pra o aluno conferir depois.$pl$,
 'exercicio',
 true),

(null,
 'Explicar como se eu fosse leigo',
 'Pede uma explicação acessível, com analogias e zero jargão sem definição.',
 $pl$Explique {{topico}} de {{materia}} como se eu nunca tivesse visto antes.

Regras:
- Use analogias do dia a dia.
- Defina cada termo técnico na primeira vez que aparece.
- Estrutura: "o que é → por que importa → como funciona → exemplo simples".
- Limite a uma página equivalente (~ 500 palavras).
- Inclua uma fórmula só se for inevitável, e explique cada símbolo.

No final, faça uma pergunta-teste pra eu verificar se entendi.$pl$,
 'estudo',
 true),

(null,
 'Quiz de revisão pra prova',
 'Monta quiz de múltipla escolha + abertas pra revisar antes da prova.',
 $pl$Monte um quiz de revisão para a prova de {{materia}} cobrindo {{topico}}.

Estrutura:
1. **10 questões de múltipla escolha** (A-D) com 1 resposta correta cada.
2. **3 questões abertas** que exigem cálculo ou demonstração.
3. Mistura entre dificuldades.

Formato:
- Enunciado.
- Opções numeradas (no múltipla escolha).
- Gabarito SEPARADO no final, com explicação curta de por que a resposta certa está certa e por que as erradas estão erradas.

Foque em armadilhas típicas dessa matéria — não pergunte só o trivial.$pl$,
 'revisao',
 true),

(null,
 'Comparar 2 conceitos',
 'Tabela comparativa entre dois conceitos parecidos que confundem aluno.',
 $pl$Compare {{topico}} (conceito A) e [outro conceito que confunde] (conceito B) em {{materia}}.

Produza:
1. **Tabela comparativa** Markdown com colunas: Aspecto | A | B
   Linhas mínimas: definição, fórmula (LaTeX), quando aplicar, unidades, sinal/orientação.
2. **Exemplo concreto** onde aplicar A e onde aplicar B (mesma situação, abordagens diferentes).
3. **Pegadinha clássica** — qual é o erro mais comum em prova ao confundir os dois.

Seja específico — evite descrições vagas tipo "depende do contexto".$pl$,
 'estudo',
 true),

(null,
 'Resolver exercício passo a passo',
 'Pede resolução detalhada com explicação de CADA passo.',
 $pl$Resolva este exercício de {{materia}} passo a passo:

[COLE O ENUNCIADO AQUI]

Regras:
1. **Identifique** os dados (em LaTeX).
2. **Identifique** o que está sendo pedido.
3. **Equacione** mostrando a fórmula original ANTES de substituir valores.
4. **Substitua** valores um por um, com unidades.
5. **Calcule** mostrando contas intermediárias (não pule operações).
6. **Resultado final** com unidades em $\boxed{...}$.
7. **Verificação**: o resultado faz sentido física/matematicamente?

Comente cada passo em 1-2 frases — não apenas mostre conta.$pl$,
 'exercicio',
 true),

(null,
 'Fichamento de capítulo',
 'Resumo formal de capítulo de livro pra entregar como atividade.',
 $pl$Faça um fichamento acadêmico do capítulo "{{titulo_doc}}" do livro de {{materia}}.

Estrutura:
1. **Referência** completa (autor, ano, página).
2. **Tese central** do capítulo (1 parágrafo).
3. **Argumentos principais** (3-5, em bullets).
4. **Conceitos-chave** definidos pelo autor (lista com definição).
5. **Citações diretas** (≥ 3, com aspas e número da página).
6. **Crítica** breve — pontos fortes e limitações (2 parágrafos).
7. **Conexões** com outros tópicos do curso.

Tom acadêmico, sem opinião pessoal vaga.$pl$,
 'redacao',
 true),

(null,
 'Estudo dirigido sobre {{materia}}',
 'Roteiro de estudo da matéria com tópicos, exercícios e prazo.',
 $pl$Monte um plano de estudo dirigido sobre {{materia}} pra eu cobrir antes da prova em {{prova_data}}.

Estrutura:
1. **Diagnóstico**: lista os tópicos da matéria com nível de prioridade (alta/média/baixa) baseado em "pegadinhas de prova".
2. **Cronograma** dia a dia até a prova:
   - Dia X: teoria de TÓPICO + 5 exercícios.
   - Dia X+1: revisar + 5 exercícios mais difíceis.
   - Último dia: simulado + leitura passiva.
3. **Material recomendado** baseado nos meus documentos já processados (não inventar fontes).
4. **Marcos de checagem**: como saber se eu já dominei o tópico.

Seja realista — não sugira "estudar 10h por dia" se faltam só 3 dias.$pl$,
 'revisao',
 true),

-- ----------------------------------------------------------------------------
-- ESTUDO — +2 (mapa mental, glossário)
-- ----------------------------------------------------------------------------

(null,
 'Mapa mental de {{topico}}',
 'Hierarquia indentada de conceitos, sub-tópicos e conexões — formato Markdown.',
 $pl$Crie um mapa mental hierárquico de {{topico}} em {{materia}}, em Markdown indentado.

Estrutura:
- {{topico}} (nó central)
  - Sub-tópico 1
    - Conceito-chave + 1 linha de definição
    - Fórmula em LaTeX (inline $...$) **OU** exemplo aplicado em 1 frase
  - Sub-tópico 2
    - ...

Regras:
- Máximo 3 níveis de indentação.
- Cada nó folha: definição + fórmula OU exemplo (não os dois).
- Mostre conexões entre sub-tópicos quando óbvio, usando `→ ver X` ao final do nó.
- Não invente subdivisões — use o que está nos meus documentos. Se um sub-tópico não foi coberto, marque "[não coberto nas minhas aulas]".

Termine com **3 perguntas-armadilha** que cruzam sub-tópicos diferentes.$pl$,
 'estudo',
 true),

(null,
 'Glossário de {{materia}}',
 'Lista alfabética de termos-chave da matéria com definição, símbolo e armadilhas.',
 $pl$Monte um glossário dos termos-chave de {{materia}} que aparecem nos meus documentos.

Para cada termo:
1. **Nome** em negrito.
2. **Definição precisa** (1-2 frases, técnica mas legível).
3. **Símbolo / notação** quando há (em LaTeX).
4. **Não confundir com** — termo parecido que costuma ser confundido em prova.
5. **Onde aparece**: tópico ou aula que introduz o termo (sem citar nome de arquivo).

Ordene alfabeticamente. Inclua **só** termos que estão nos meus documentos — não invente. Se um termo apareceu mas não foi definido formalmente, marque "[verificar com o professor]".

Mínimo 15 termos. Se a matéria não tiver tantos termos distintos, complete com sub-termos relevantes.$pl$,
 'estudo',
 true),

-- ----------------------------------------------------------------------------
-- EXERCÍCIO — +3 (variações, identificar tipo, corrigir resolução)
-- ----------------------------------------------------------------------------

(null,
 'Variações do mesmo exercício',
 'Gera 5 variações que treinam o mesmo método com valores e contextos diferentes.',
 $pl$Pegue o exercício abaixo de {{materia}} e gere 5 variações que cobrem o MESMO método de resolução, mas com:

- Valores numéricos diferentes (recalcule pra dar respostas distintas).
- Contexto / enunciado diferente (mesma estrutura matemática, narrativa nova).
- Unidades diferentes quando aplicável (forçar conversão).

[COLE O EXERCÍCIO ORIGINAL AQUI]

Para cada variação:
- Enunciado novo.
- Dados em LaTeX.
- Resposta final num **gabarito separado** no fim (só o número + unidade, sem passos).

Mantenha o nível de dificuldade igual ao original — o objetivo é treinar o método até automatizar, não escalar dificuldade. Não resolva passo a passo.$pl$,
 'exercicio',
 true),

(null,
 'Identificar tipo de problema',
 'Diante de um enunciado, classifica o tipo e dá estratégia — sem resolver.',
 $pl$Diante do enunciado abaixo de {{materia}}, **NÃO RESOLVA**. Só me ajude a identificar como abordar.

[COLE O ENUNCIADO]

Responda nessa ordem:
1. **Tópico** dentro de {{materia}} que esse problema cobra.
2. **Tipo de problema** — categorize (ex: "circuito RL em regime transitório", "limite por L'Hôpital", "integração por substituição", "interpretação de dado experimental").
3. **Fórmulas / teoremas** aplicáveis (em LaTeX).
4. **Estratégia em 3-5 passos** (sem fazer as contas).
5. **Pegadinha comum** nesse tipo — onde alunos costumam errar.
6. **Pista de sanidade** do resultado esperado (ordem de grandeza, unidade, sinal — sem dar o número).

O objetivo é eu pensar com você antes de tentar resolver sozinho.$pl$,
 'exercicio',
 true),

(null,
 'Corrigir minha resolução',
 'Aluno cola tentativa, IA aponta erro raiz e próximo passo — sem entregar resposta.',
 $pl$Revise minha tentativa de resolver este exercício de {{materia}}.

ENUNCIADO:
[COLE O ENUNCIADO]

MINHA RESOLUÇÃO:
[COLE SUA TENTATIVA, mesmo se travou no meio]

Faça nessa ordem:
1. **Diagnóstico passo a passo**: onde a resolução está certa? onde quebra?
2. **Erro raiz** — o primeiro ponto onde algo deu errado (não fique apontando consequências).
3. **Conceito que faltou** — qual ideia teria evitado o erro.
4. **Próximo passo** — o que eu deveria escrever NA LINHA SEGUINTE pra destravar (**NÃO** resolva o resto).
5. **Erro armadilha?** — esse é um erro comum/clássico ou foi deslize de cálculo.

Não me dê a resposta final. O objetivo é eu terminar sozinho com a pista certa.$pl$,
 'exercicio',
 true),

-- ----------------------------------------------------------------------------
-- REDAÇÃO — +4 (outline, revisar redação, resenha crítica, construir argumentação)
-- ----------------------------------------------------------------------------

(null,
 'Estruturar redação acadêmica',
 'Outline com introdução, desenvolvimento e conclusão — fontes só do material.',
 $pl$Monte o outline (estrutura) de uma redação acadêmica em {{materia}} sobre {{topico}}.

Estrutura esperada:

1. **Introdução** (1 parágrafo)
   - Contextualização do tema.
   - Problema / pergunta central.
   - Tese (ou tese provisória).
   - Roadmap do texto em 1 frase ("argumentarei X mostrando A, B, C").

2. **Desenvolvimento** (3-4 parágrafos)
   Para cada parágrafo, especifique:
   - Ideia central (tópico-frase).
   - Evidência ou exemplo (dos meus documentos quando possível — não invente fontes).
   - Conexão com a tese.

3. **Conclusão** (1 parágrafo)
   - Retomada da tese (não literal).
   - Síntese dos argumentos.
   - Implicações ou abertura para discussão.

4. **Possíveis fontes** — só sugira referências que aparecem nos meus documentos. Se faltar evidência pra algum argumento, marque "[buscar referência sobre X]".

Tom acadêmico, sem voz pessoal vaga ("eu acho", "na minha opinião").$pl$,
 'redacao',
 true),

(null,
 'Revisar minha redação',
 'Feedback parágrafo a parágrafo + checklist — sem reescrever o texto inteiro.',
 $pl$Revise o texto abaixo escrito para {{materia}}.

[COLE SEU TEXTO AQUI]

Devolva em 4 blocos:

1. **Diagnóstico geral** (3-5 linhas): tese clara? argumentação coerente? linguagem adequada ao nível acadêmico?

2. **Problemas parágrafo a parágrafo**:
   - Cite o parágrafo (por número ou início de frase).
   - Aponte o problema (vago, repetitivo, sem evidência, gramática, conector ausente, etc.).
   - Sugira reescrita curta (1-2 linhas).

3. **Pontos fortes** — o que está funcionando e deve ser mantido (não elogio vago).

4. **Checklist final**:
   - [ ] Tese explícita?
   - [ ] Cada parágrafo defende algo?
   - [ ] Evidências citadas?
   - [ ] Coesão entre parágrafos?
   - [ ] Conclusão sintetiza (sem repetir)?

**Não reescreva o texto inteiro.** Devolva feedback acionável para eu reescrever.$pl$,
 'redacao',
 true),

(null,
 'Resenha crítica de {{titulo_doc}}',
 'Estrutura acadêmica de resenha: apresentação + síntese + análise crítica fundamentada.',
 $pl$Faça uma resenha crítica do texto "{{titulo_doc}}" de {{materia}}.

Estrutura:

1. **Referência completa** — autor, título, ano, contexto editorial.
2. **Apresentação do autor** — formação, área, relevância (1 parágrafo curto).
3. **Síntese da obra** — tese central, objetivo, estrutura argumentativa (1-2 parágrafos).
4. **Análise crítica**:
   - Pontos fortes (argumentos sólidos, evidências, originalidade).
   - Limitações (lacunas, contradições, dado datado, viés metodológico).
   - Diálogo com outras leituras do curso (quando há conexão óbvia nos meus documentos).
5. **Avaliação final** — para quem o texto é útil e em que contexto.

Tom acadêmico — opinião **fundamentada**, não "gostei / não gostei". Cite trechos com aspas + número de página quando referenciar diretamente. Não invente páginas se não tiver — marque "[p. ?]".$pl$,
 'redacao',
 true),

(null,
 'Construir argumentação',
 'Defende uma tese: argumentos do mais forte ao mais fraco + contra-argumentos.',
 $pl$Me ajude a montar uma argumentação para defender a seguinte tese em {{materia}}:

TESE: [COLE A TESE AQUI]

Devolva:

1. **Tese refinada** — versão reescrita mais precisa e defensável que a original.

2. **3-5 argumentos principais**, ordenados do mais forte ao mais fraco. Para cada um:
   - Argumento em 1 frase.
   - Evidência ou raciocínio que sustenta (dos meus documentos quando possível).
   - Possível contra-argumento.
   - Como responder ao contra-argumento.

3. **Conexão entre argumentos** — eles se reforçam? têm tensão entre si? como organizar na redação?

4. **O que NÃO defender** — pontos fracos da tese que é melhor evitar ou conceder logo na introdução.

Foque em substância — não em retórica vazia. Se a tese for indefensável como está, **diga**, e proponha uma versão defensável.$pl$,
 'redacao',
 true),

-- ----------------------------------------------------------------------------
-- REVISÃO — +3 (flashcards, cheat sheet, simulado)
-- ----------------------------------------------------------------------------

(null,
 'Flashcards estilo Anki',
 'Gera 20 cards pergunta/resposta curtas em formato pronto pra importar.',
 $pl$Gere 20 flashcards estilo Anki sobre {{topico}} de {{materia}}, em formato de lista.

Formato de cada flashcard:

**Frente:** [pergunta curta e específica]
**Verso:** [resposta direta, ≤ 3 linhas]
---

Regras:
- 20 cards no total.
- Mistura entre:
  - Definições ("o que é X?")
  - Fórmulas ("qual a fórmula de Y?")
  - Aplicação ("quando se usa Z?")
  - Cálculo rápido ("qual o valor de... em N segundos?")
  - Armadilhas ("qual a diferença entre A e B?")
- Frente **nunca** pode conter a resposta. Verso sempre direto, sem rodeios.
- Fórmulas em LaTeX (inline `$...$`).

Use **só** conteúdo dos meus documentos. Não invente fatos nem fórmulas.$pl$,
 'revisao',
 true),

(null,
 'Cheat sheet pra prova de {{materia}}',
 '1 página densa pra consulta rápida no dia anterior à prova.',
 $pl$Monte uma cheat sheet de **1 página densa** pra prova de {{materia}} cobrindo {{topico}}.

Layout (Markdown):
- Use tabelas e listas curtas — sem texto corrido.
- Densidade alta: cada linha precisa ter valor.

Seções obrigatórias:
1. **Fórmulas-chave** — tabela: nome | fórmula (LaTeX) | quando usar | unidades.
2. **Constantes / valores numéricos** relevantes (g, ε₀, prazos legais, regras de conjugação — depende da matéria).
3. **Procedimentos** — fluxograma textual curto: "se enunciado tem X → use Y".
4. **Armadilhas clássicas** — bullets de uma linha.
5. **Mini-glossário** — 5-7 termos essenciais com definição em 1 linha.

Restrições:
- Tudo equivalente a 1 página (~ 600 palavras).
- Sem exemplo longo, sem dedução de fórmula, sem prosa.
- Otimizar pra consulta rápida no dia anterior à prova.

Não invente fórmulas — use **só** o que está nos meus documentos. Se faltar algo importante, marque "[checar caderno]".$pl$,
 'revisao',
 true),

(null,
 'Simulado completo de {{materia}}',
 'Mockup de prova com tempo sugerido, objetivas + discursivas e gabarito separado.',
 $pl$Monte um simulado completo de {{materia}} cobrindo {{topico}}, no formato da minha prova em {{prova_data}}.

Estrutura:

1. **Cabeçalho** — instruções e **tempo sugerido** (calcule baseado na quantidade: ~5min por objetiva, ~15min por discursiva).
2. **Parte A — Objetivas** (5-8 questões de múltipla escolha, alternativas A-E).
3. **Parte B — Discursivas** (2-4 questões abertas que exigem cálculo, demonstração ou argumentação).
4. **Mistura de dificuldade**: ~30% fácil / ~50% médio / ~20% difícil.
5. **Foco nas pegadinhas** típicas dessa matéria (não pergunte só o trivial).

Depois do simulado, em **seção separada** no final:
- **Gabarito das objetivas** (só letras).
- **Resolução resumida das discursivas** — passos-chave, não a resolução completa (incentiva o aluno a tentar antes).

Use **só** conteúdo dos meus documentos. Não invente tópicos que o professor não cobriu.$pl$,
 'revisao',
 true),

-- ----------------------------------------------------------------------------
-- ESTUDO — +2 (Feynman reverso, conexões interdisciplinares)
-- ----------------------------------------------------------------------------

(null,
 'Feynman reverso — me corrija',
 'Aluno explica o tópico pra IA; IA diagnostica vagueza, jargão sem definição e erros.',
 $pl$Vou te explicar {{topico}} de {{materia}} como se eu fosse o professor. Sua tarefa é diagnosticar onde minha explicação fica fraca, vaga ou errada — usando a Técnica de Feynman como critério.

MINHA EXPLICAÇÃO:
[COLE SUA EXPLICAÇÃO AQUI]

Devolva nessa ordem:
1. **Pontos claros** — onde a explicação está sólida e didática (1-2 bullets).
2. **Pontos vagos** — onde escapei pra jargão técnico sem definir, ou usei "obviamente" / "é claro que" pra cobrir buraco.
3. **Erros conceituais** — onde está objetivamente errado ou impreciso (cite o trecho exato).
4. **Lacunas** — o que faltou cobrir pra um leigo entender de verdade.
5. **3 perguntas-teste** que um aluno faria depois da minha explicação — e que eu provavelmente não saberia responder bem.

Use só conteúdo dos meus documentos. Se algo que afirmei não estava lá, marque "[fora do material]" — não confirme nem refute, só sinalize.$pl$,
 'estudo',
 true),

(null,
 'Conexões interdisciplinares',
 'Mapeia como o tópico conversa com outras matérias dos meus documentos.',
 $pl$Mostre como {{topico}} de {{materia}} se conecta com outras matérias que tenho nos meus documentos.

Para cada conexão (mínimo 3, se existirem):
1. **Matéria conectada** — nome e tópico específico.
2. **Tipo de conexão**:
   - 🔗 Pré-requisito (uso conceito de lá pra entender aqui)
   - 🔁 Aplicação inversa (aqui uso técnica que aprendi naquela)
   - ⚖️ Contraste (mesmo nome, sentidos diferentes em cada matéria)
   - 🧩 Composição (combinar os dois resolve um terceiro problema)
3. **Exemplo concreto** — uma situação onde os dois aparecem juntos.
4. **Por que importa** — o que essa conexão me dá além de cada matéria isolada.

Não force conexões. Se as ligações nos meus documentos são fracas, diga "esse tópico é razoavelmente isolado no material que você tem" e pare em 1-2 conexões reais.$pl$,
 'estudo',
 true),

-- ----------------------------------------------------------------------------
-- EXERCÍCIO — +2 (hint socrático progressivo, template por tipo)
-- ----------------------------------------------------------------------------

(null,
 'Hint socrático progressivo',
 'Três níveis de dica em blocos separados — sem entregar a resposta.',
 $pl$Estou travado neste exercício de {{materia}}. **NÃO RESOLVA** — me dê hints em 3 níveis crescentes, em blocos separados.

ENUNCIADO:
[COLE O ENUNCIADO]

ATÉ ONDE CHEGUEI:
[COLE SUA TENTATIVA — ou diga "ainda não comecei"]

Formato (cada hint num bloco fechado, pra eu ler um por vez):

**🟢 Hint 1 — suave**
Uma pergunta orientadora que me faz olhar pro problema sob outro ângulo. Sem dar fórmula, sem nomear técnica.

**🟡 Hint 2 — médio** *(só leia se o Hint 1 não destravou)*
Aponta o conceito ou teorema relevante (nome, não aplicação ainda).

**🔴 Hint 3 — forte** *(só leia se o Hint 2 não destravou)*
Dá o primeiro passo concreto (ex: "aplique substituição u = ..."), mas para na próxima linha. Eu sigo daí.

Não junte tudo num parágrafo. Cada bloco isolado, com espaço em branco entre eles.$pl$,
 'exercicio',
 true),

(null,
 'Template de resolução por tipo',
 'Esqueleto genérico aplicável a qualquer caso desse tipo de problema — sem caso específico.',
 $pl$Me dê o template / "esqueleto" de resolução pra problemas do tipo {{topico}} em {{materia}}.

**NÃO** use um problema específico — quero o roteiro genérico aplicável a qualquer caso desse tipo.

Estrutura:
1. **Como reconhecer** que um problema é desse tipo (3-5 sinais no enunciado).
2. **Dados típicos** que estarão disponíveis (em LaTeX quando aplicável).
3. **Roteiro de resolução** numerado, em forma genérica:
   - "Passo 1: identificar X"
   - "Passo 2: aplicar fórmula Y a partir de X"
   - ...
4. **Pontos de decisão** — onde o roteiro bifurca (ex: "se condição A → passo 4a; senão → 4b").
5. **Sanity check final** — como saber se o resultado faz sentido (ordem de grandeza, unidade, sinal).
6. **Pegadinha comum** desse tipo.

Use só técnicas que aparecem nos meus documentos. Não invente método "esperto" que o professor não ensinou.$pl$,
 'exercicio',
 true),

-- ----------------------------------------------------------------------------
-- REDAÇÃO — +2 (parafrasear sem plágio, citação ABNT)
-- ----------------------------------------------------------------------------

(null,
 'Parafrasear sem plágio',
 '3 versões em distância crescente do original, todas com citação obrigatória.',
 $pl$Parafraseie o trecho abaixo pra eu usar na minha redação de {{materia}} sem cair em plágio.

TRECHO ORIGINAL + FONTE (autor, ano, página):
[COLE O TRECHO E A FONTE]

Devolva 3 versões em ordem de distância do original:

1. **Paráfrase próxima** — mesma estrutura, sinônimos e reordenação leve. Útil quando preciso da ideia inteira como o autor formulou.
2. **Paráfrase média** — reescrita estrutural: muda ordem das ideias, combina ou separa frases. Mantém todo o conteúdo, voz minha.
3. **Síntese** — versão minha que captura **só** a ideia central em 1-2 frases, integrável ao meu argumento.

Para cada versão, mostre:
- O texto parafraseado.
- A **citação obrigatória** em formato autor-data: "Silva (2020) argumenta que..." ou "(SILVA, 2020, p. X)".
- ⚠️ Aviso quando a versão estiver "perto demais" do original (ainda exige citação direta com aspas, não basta parafrasear).

Nunca devolva versão sem fonte. Paráfrase acadêmica **sempre** cita o autor — mesmo a síntese.$pl$,
 'redacao',
 true),

(null,
 'Formatar citações ABNT',
 'Referências (NBR 6023) + citações no texto (NBR 10520) — padrão UnB.',
 $pl$Formate as referências e citações abaixo no padrão ABNT (NBR 6023 para referências, NBR 10520 para citações no corpo do texto).

FONTES (pode estar bagunçado — títulos, autores, anos, URLs, páginas):
[COLE AS FONTES AQUI]

Devolva em 2 blocos:

1. **Referências bibliográficas** (vai no fim do trabalho, ordem alfabética por sobrenome):
   - Livro: SOBRENOME, Nome. **Título**. Edição. Cidade: Editora, ano.
   - Capítulo: SOBRENOME, Nome. Título do capítulo. In: ORGANIZADOR, Nome (org.). **Título do livro**. Cidade: Editora, ano. p. X-Y.
   - Artigo: SOBRENOME, Nome. Título do artigo. **Revista**, cidade, v. X, n. Y, p. Z-W, ano.
   - Online: SOBRENOME, Nome. **Título**. Local, data. Disponível em: URL. Acesso em: dd mmm. aaaa.

2. **Citações no corpo do texto** — pra cada fonte, mostre as 2 formas:
   - **Direta** (≤ 3 linhas): "trecho exato entre aspas" (SOBRENOME, ano, p. X).
   - **Indireta** (paráfrase): Conforme Sobrenome (ano), [ideia em voz minha].
   - Quando a citação direta tiver mais de 3 linhas, indique recuo de 4 cm e fonte menor.

Se faltar dado (página, edição, ano, cidade), marque "[completar: X]" — **não invente** informação bibliográfica.$pl$,
 'redacao',
 true),

-- ----------------------------------------------------------------------------
-- REVISÃO — +2 (repetição espaçada, sabatina oral)
-- ----------------------------------------------------------------------------

(null,
 'Plano de repetição espaçada',
 'Cronograma com intervalos 1-3-7-14-30 dias ajustado ao prazo até a prova.',
 $pl$Monte um cronograma de repetição espaçada (spaced repetition) pra {{topico}} de {{materia}}, terminando na minha prova em {{prova_data}}.

Use a sequência clássica: revisão nos dias 1, 3, 7, 14, 30 após cada estudo inicial — **ajustada** ao prazo real disponível.

Estrutura:
1. **Diagnóstico** — quantos dias até a prova e quantos blocos de tópicos cabem no cronograma sem amontoar.
2. **Calendário diário** — tabela: data | bloco novo (se houver) | revisões espaçadas dos blocos anteriores | tempo estimado (min).
3. **Tipo de revisão por dia**:
   - Dia 1 do bloco: leitura ativa + resumo próprio.
   - Dia 3: flashcards (active recall, **não** releitura).
   - Dia 7: questões aplicadas (sem olhar a teoria primeiro).
   - Dia 14: simulado parcial só desse bloco.
   - Dia 30 (se couber): revisão rápida de 15 min.
4. **Indicador de falha** — se errar > 30% num bloco, voltar pra revisão tipo Dia 1 (reset do contador).

Se faltarem poucos dias, **não me dê cronograma irreal**. Mostra a versão comprimida honesta (ex: "em 5 dias só dá pra 1-3-5 com 2 blocos") em vez de fingir que cabe tudo.$pl$,
 'revisao',
 true),

(null,
 'Sabatina oral',
 'Arguição de banca pergunta por pergunta — dificuldade crescente, relatório no fim.',
 $pl$Faça uma sabatina oral comigo sobre {{topico}} de {{materia}}, simulando arguição de banca.

Regras:
1. **Uma pergunta por vez** — não despeje questionário inteiro. Espere minha resposta antes da próxima.
2. **Dificuldade crescente** — comece em definição/básico, escale pra aplicação, depois síntese e casos limítrofes.
3. **Reaja à minha resposta**:
   - Se acertar: aprofunde com follow-up no mesmo tema.
   - Se errar ou vacilar: aponte o erro objetivamente, dê a resposta correta de forma sucinta, e siga adiante (não remoa).
   - Se eu pular: marque "[passou]" e volte no fim.
4. **Tom de banca** — exigente mas justo. Não elogie cada resposta certa, não force confronto desnecessário.
5. **Total**: 10-12 perguntas.

No fim, devolva um **relatório curto**:
- ✅ O que dominei (com confiança).
- ⚠️ O que está raso (sei o nome mas não sei aplicar).
- ❌ O que arriscaria errar numa prova de verdade.

Use só conteúdo dos meus documentos. Comece **agora** com a primeira pergunta e aguarde.$pl$,
 'revisao',
 true);
