-- =============================================================================
-- Migration 0014 — Seed de dados de teste (50 profiles + cascata realista)
-- =============================================================================
-- Gera ~15k linhas distribuídas conforme combinado:
--   profiles: 50  | user_consents: ~115  | user_system_prompts: ~65
--   prompt_library privados: ~20  | documents: ~1.250  | jobs: ~1.250
--   job_events: ~8.700  | generated_content: ~3.100  | feedback: ~190
--
-- Todos os perfis têm is_test=true. Cleanup completo via:
--   DELETE FROM public.profiles WHERE is_test = true;
--   DELETE FROM auth.users     WHERE email LIKE '%@psp2.test';
--
-- Reproducibilidade: setseed(0.42) — rodar de novo gera os mesmos dados
-- (útil pra testes determinísticos e pra debugar).
-- =============================================================================

DO $seed$
DECLARE
  -- ===========================================================================
  -- ARRAYS-BASE
  -- ===========================================================================
  v_nomes text[] := ARRAY[
    'Marina Souza Oliveira',   'Lucas Almeida Pereira',    'Beatriz Costa Lima',
    'Rafael Mendes Silva',     'Júlia Ferreira Rocha',     'Pedro Henrique Vieira',
    'Camila Barbosa Santos',   'Gabriel Cardoso Lima',     'Ana Clara Ribeiro Sá',
    'Mateus Carvalho Dias',    'Larissa Pinto Souza',      'Felipe Andrade Costa',
    'Isabela Moreira Reis',    'Bruno Alves Nogueira',     'Carolina Sá Pereira',
    'Vinícius Lopes Gomes',    'Fernanda Castro Lima',     'Thiago Martins Vidal',
    'Letícia Pereira Cunha',   'Rodrigo Nascimento Lima',  'Amanda Cabral Silva',
    'Henrique Soares Melo',    'Beatriz Andrade Pinto',    'Daniel Marques Cruz',
    'Sofia Vargas Lima',       'João Pedro Tavares',       'Mariana Duarte Coelho',
    'Eduardo Brito Macedo',    'Patrícia Almeida Reis',    'Caio Bittencourt Lima',
    'Luana Pinto Reis',        'Diego Ramos Oliveira',     'Renata Costa Bezerra',
    'Otávio Lopes Vargas',     'Carla Beatriz Mendes',     'Vitor Hugo Carneiro',
    'Aline Borges Camargo',    'Ricardo Faria Pessoa',     'Natália Queiroz Lima',
    'Marcelo Tavares Silva',   'Helena Macedo Souza',      'Igor Rezende Pires',
    'Bianca Ferraz Pinto',     'Leonardo Vieira Barros',   'Yasmin Albuquerque',
    'Gustavo Rocha Teles',     'Luiza Câmara Fontes',      'André Carvalho Costa',
    'Manuela Veloso Lima',     'Tiago Antunes Cerqueira'
  ];

  v_cursos text[] := ARRAY[
    'Engenharia Civil', 'Engenharia de Produção', 'Engenharia Mecânica',
    'Engenharia Elétrica', 'Ciência da Computação', 'Engenharia de Software',
    'Medicina', 'Direito', 'Administração', 'Economia', 'Letras - Português',
    'Arquitetura e Urbanismo', 'Comunicação Social', 'Psicologia',
    'Pedagogia', 'História', 'Ciências Sociais'
  ];

  v_materias_por_curso jsonb := '{
    "Engenharia Civil": [
      {"code":"CALC2","nome":"Cálculo 2"},
      {"code":"FIS3","nome":"Física 3"},
      {"code":"RESMAT","nome":"Resistência dos Materiais"},
      {"code":"HID","nome":"Hidráulica"},
      {"code":"TOPO","nome":"Topografia"}
    ],
    "Engenharia de Produção": [
      {"code":"PO","nome":"Pesquisa Operacional"},
      {"code":"EMETOD","nome":"Engenharia de Métodos"},
      {"code":"CALC2","nome":"Cálculo 2"},
      {"code":"EST","nome":"Estatística"},
      {"code":"CUSTOS","nome":"Análise de Custos"}
    ],
    "Engenharia Mecânica": [
      {"code":"TERMO","nome":"Termodinâmica"},
      {"code":"MECFLU","nome":"Mecânica dos Fluidos"},
      {"code":"CALC3","nome":"Cálculo 3"},
      {"code":"DINAM","nome":"Dinâmica"},
      {"code":"MATMAQ","nome":"Materiais e Máquinas"}
    ],
    "Engenharia Elétrica": [
      {"code":"CIRC1","nome":"Circuitos Elétricos 1"},
      {"code":"ELMAG","nome":"Eletromagnetismo"},
      {"code":"SDIG","nome":"Sistemas Digitais"},
      {"code":"CALC3","nome":"Cálculo 3"},
      {"code":"SLINEAR","nome":"Sinais e Sistemas Lineares"}
    ],
    "Ciência da Computação": [
      {"code":"ALG2","nome":"Algoritmos 2"},
      {"code":"BD","nome":"Banco de Dados"},
      {"code":"SO","nome":"Sistemas Operacionais"},
      {"code":"IA","nome":"Inteligência Artificial"},
      {"code":"REDES","nome":"Redes de Computadores"}
    ],
    "Engenharia de Software": [
      {"code":"ESREQ","nome":"Engenharia de Requisitos"},
      {"code":"PADRPROJ","nome":"Padrões de Projeto"},
      {"code":"BD","nome":"Banco de Dados"},
      {"code":"PCOMP","nome":"Paradigmas Computacionais"},
      {"code":"TESTSW","nome":"Teste de Software"}
    ],
    "Medicina": [
      {"code":"ANAT","nome":"Anatomia Humana"},
      {"code":"FISIO","nome":"Fisiologia"},
      {"code":"BIOQ","nome":"Bioquímica Médica"},
      {"code":"HISTO","nome":"Histologia"},
      {"code":"PATOL","nome":"Patologia Geral"}
    ],
    "Direito": [
      {"code":"DCONST","nome":"Direito Constitucional"},
      {"code":"DCIVIL","nome":"Direito Civil"},
      {"code":"DPENAL","nome":"Direito Penal"},
      {"code":"HERM","nome":"Hermenêutica Jurídica"},
      {"code":"DPROC","nome":"Direito Processual"}
    ],
    "Administração": [
      {"code":"ADM1","nome":"Teoria Geral da Administração"},
      {"code":"MKTING","nome":"Marketing"},
      {"code":"GESTAO","nome":"Gestão de Pessoas"},
      {"code":"FIN1","nome":"Finanças Corporativas"},
      {"code":"EST","nome":"Estatística Aplicada"}
    ],
    "Economia": [
      {"code":"MICRO2","nome":"Microeconomia 2"},
      {"code":"MACRO2","nome":"Macroeconomia 2"},
      {"code":"ECTRIA","nome":"Econometria"},
      {"code":"HEC","nome":"História Econômica"},
      {"code":"CALC2","nome":"Cálculo 2"}
    ],
    "Letras - Português": [
      {"code":"LITBR","nome":"Literatura Brasileira"},
      {"code":"SINT","nome":"Sintaxe"},
      {"code":"FONO","nome":"Fonologia"},
      {"code":"LING","nome":"Linguística Geral"},
      {"code":"LITPT","nome":"Literatura Portuguesa"}
    ],
    "Arquitetura e Urbanismo": [
      {"code":"PROJ3","nome":"Projeto Arquitetônico 3"},
      {"code":"URBA","nome":"Urbanismo"},
      {"code":"HARQ","nome":"História da Arquitetura"},
      {"code":"CONFOR","nome":"Conforto Ambiental"},
      {"code":"REPR","nome":"Representação Gráfica"}
    ],
    "Comunicação Social": [
      {"code":"TCOM","nome":"Teoria da Comunicação"},
      {"code":"JORN","nome":"Jornalismo Impresso"},
      {"code":"AUDV","nome":"Audiovisual"},
      {"code":"SEMIO","nome":"Semiótica"},
      {"code":"PUBPR","nome":"Publicidade e Propaganda"}
    ],
    "Psicologia": [
      {"code":"PSGER","nome":"Psicologia Geral"},
      {"code":"NEURO","nome":"Neuropsicologia"},
      {"code":"PSDES","nome":"Psicologia do Desenvolvimento"},
      {"code":"PSSOC","nome":"Psicologia Social"},
      {"code":"AVPSI","nome":"Avaliação Psicológica"}
    ],
    "Pedagogia": [
      {"code":"DIDAT","nome":"Didática"},
      {"code":"PSIED","nome":"Psicologia da Educação"},
      {"code":"FILED","nome":"Filosofia da Educação"},
      {"code":"HISED","nome":"História da Educação"},
      {"code":"ALFLET","nome":"Alfabetização e Letramento"}
    ],
    "História": [
      {"code":"HBRA","nome":"História do Brasil"},
      {"code":"HCONT","nome":"História Contemporânea"},
      {"code":"HMED","nome":"História Medieval"},
      {"code":"TEOH","nome":"Teoria da História"},
      {"code":"HAMER","nome":"História da América"}
    ],
    "Ciências Sociais": [
      {"code":"SOC1","nome":"Sociologia Clássica"},
      {"code":"ANTROP","nome":"Antropologia"},
      {"code":"POL","nome":"Ciência Política"},
      {"code":"MQUANT","nome":"Métodos Quantitativos"},
      {"code":"PCONT","nome":"Pensamento Sociológico Contemporâneo"}
    ]
  }'::jsonb;

  -- Distribuição de tipos de doc (60/10/8/6/4/4/4/4)
  v_tipos text[] := ARRAY['Aula','Lista','Resumo','Estudo Dirigido','Plano','Apostila','Questionário','Outro'];
  v_tipo_probs numeric[] := ARRAY[0.60,0.70,0.78,0.84,0.88,0.92,0.96,1.00];

  -- Distribuição de formats (65/20/10/3/2)
  v_formats text[] := ARRAY['pdf','pptx','docx','image','md'];
  v_format_probs numeric[] := ARRAY[0.65,0.85,0.95,0.98,1.00];

  -- Distribuição de status (75/10/5/5/3/2)
  v_statuses text[] := ARRAY['completed','completed_with_warning','failed','needs_review','pending','processing'];
  v_status_probs numeric[] := ARRAY[0.75,0.85,0.90,0.95,0.98,1.00];

  -- Templates de prompts privados (sorteia se user cria)
  v_priv_prompt_titles text[] := ARRAY[
    'Resumir aula desta semana',
    'Lista 5 questões sobre',
    'Comparar com aula anterior',
    'Explicar pré-requisitos',
    'Achar fórmula chave',
    'Gerar quiz rápido',
    'Tabela comparativa',
    'Roteiro de revisão',
    'Pegadinhas comuns',
    'Mapa de conexões',
    'Versão TL;DR',
    'Esclarecer dúvida específica'
  ];
  v_priv_prompt_cats text[] := ARRAY['estudo','exercicio','revisao','estudo','estudo','revisao','estudo','revisao','exercicio','estudo','estudo','estudo'];

  -- ===========================================================================
  -- LOOP VARIABLES
  -- ===========================================================================
  i int; j int; k int;
  v_user_id uuid; v_doc_id uuid; v_job_id uuid;
  v_email text; v_nome text; v_curso text; v_materias jsonb;
  v_perfil_uso text; v_has_drive boolean; v_is_admin boolean;
  v_semestre text; v_created_at timestamptz;
  v_n_docs int; v_n_consents int; v_n_sysprompts int; v_n_priv_prompts int;

  v_doc_format text; v_doc_tipo text; v_doc_size bigint;
  v_doc_materia_code text; v_doc_materia_nome text;
  v_doc_created timestamptz; v_doc_processed timestamptz; v_doc_archived timestamptz;
  v_doc_titulo text; v_doc_identif text; v_doc_filename_orig text; v_doc_filename_final text;

  v_job_status text; v_job_step text; v_job_progress int; v_job_attempt int;
  v_job_error text; v_chars_input int; v_chars_syn int; v_chars_comp int;
  v_job_cost numeric; v_job_started timestamptz; v_job_completed timestamptz;
  v_job_validation_score numeric;

  v_rand numeric;
  v_idx int;
BEGIN
  -- Reproducibilidade
  PERFORM setseed(0.42);

  -- ===========================================================================
  -- LOOP DE PROFILES (1..50)
  -- ===========================================================================
  FOR i IN 1..50 LOOP
    v_user_id := gen_random_uuid();
    v_email := 'seed-' || lpad(i::text, 3, '0') || '@psp2.test';
    v_nome := v_nomes[i];

    -- Perfil de uso (recem 10% / leve 25% / medio 50% / pesado 15%)
    v_rand := random();
    IF v_rand < 0.10 THEN v_perfil_uso := 'recem';
    ELSIF v_rand < 0.35 THEN v_perfil_uso := 'leve';
    ELSIF v_rand < 0.85 THEN v_perfil_uso := 'medio';
    ELSE v_perfil_uso := 'pesado';
    END IF;

    v_is_admin := i IN (10, 47);                          -- 2 admins
    v_has_drive := v_is_admin OR random() < 0.55;        -- ~60% com Drive

    IF v_perfil_uso = 'recem' THEN
      v_curso := NULL;
      v_semestre := NULL;
      v_materias := '[]'::jsonb;
      v_has_drive := false;
      v_created_at := now() - (random() * interval '7 days');
    ELSE
      v_curso := v_cursos[1 + floor(random() * array_length(v_cursos, 1))::int];
      v_semestre := CASE WHEN random() < 0.90 THEN '2026.1' ELSE '2025.2' END;
      v_materias := COALESCE(v_materias_por_curso->v_curso, '[]'::jsonb);
      v_created_at := timestamp '2026-03-01' + (random() * interval '60 days');
    END IF;

    -- auth.users
    INSERT INTO auth.users (
      id, email, aud, role,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data
    ) VALUES (
      v_user_id, v_email, 'authenticated', 'authenticated',
      v_created_at, v_created_at, v_created_at,
      jsonb_build_object('full_name', v_nome, 'seed', true)
    );

    -- profiles (UPSERT: trigger on_auth_user_created já cria a row básica via handle_new_user)
    INSERT INTO public.profiles (
      id, email, full_name, semestre_atual, materias,
      drive_root_folder_id, drive_connected_at,
      is_admin, curso, is_test, created_at, updated_at
    ) VALUES (
      v_user_id, v_email,
      CASE WHEN v_perfil_uso = 'recem' AND random() < 0.4 THEN NULL ELSE v_nome END,
      v_semestre,
      v_materias,
      CASE WHEN v_has_drive THEN 'seed-drive-folder-' || lpad(i::text, 3, '0') ELSE NULL END,
      CASE WHEN v_has_drive THEN v_created_at + interval '5 minutes' ELSE NULL END,
      v_is_admin, v_curso, true, v_created_at, v_created_at + interval '1 hour'
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name            = EXCLUDED.full_name,
      semestre_atual       = EXCLUDED.semestre_atual,
      materias             = EXCLUDED.materias,
      drive_root_folder_id = EXCLUDED.drive_root_folder_id,
      drive_connected_at   = EXCLUDED.drive_connected_at,
      is_admin             = EXCLUDED.is_admin,
      curso                = EXCLUDED.curso,
      is_test              = EXCLUDED.is_test,
      created_at           = EXCLUDED.created_at,
      updated_at           = EXCLUDED.updated_at;

    -- =========================================================================
    -- user_consents (2-3 por user; recém-cadastrados só 2)
    -- =========================================================================
    v_n_consents := CASE WHEN v_perfil_uso = 'recem' THEN 2
                         WHEN random() < 0.3 THEN 3 ELSE 2 END;

    INSERT INTO public.user_consents (user_id, consent_type, version, given_at, ip, user_agent)
      VALUES (v_user_id, 'privacy_policy', 'v1.0', v_created_at,
              ('177.45.' || (1 + floor(random()*255))::int || '.' || (1 + floor(random()*255))::int)::inet,
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    INSERT INTO public.user_consents (user_id, consent_type, version, given_at, ip, user_agent)
      VALUES (v_user_id, 'terms_of_service', 'v1.0', v_created_at,
              ('177.45.' || (1 + floor(random()*255))::int || '.' || (1 + floor(random()*255))::int)::inet,
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    IF v_n_consents = 3 THEN
      INSERT INTO public.user_consents (user_id, consent_type, version, given_at, ip, user_agent)
        VALUES (v_user_id, 'privacy_policy', 'v1.1',
                v_created_at + interval '30 days',
                ('177.45.' || (1 + floor(random()*255))::int || '.' || (1 + floor(random()*255))::int)::inet,
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    END IF;

    -- =========================================================================
    -- user_system_prompts (1-2 por user, recém=0)
    -- =========================================================================
    IF v_perfil_uso <> 'recem' THEN
      v_n_sysprompts := CASE WHEN random() < 0.3 THEN 2 ELSE 1 END;

      INSERT INTO public.user_system_prompts (
        user_id, prompt_text, semester_snapshot, source_documents, version, is_active, created_at
      ) VALUES (
        v_user_id,
        'Sou aluno(a) de ' || v_curso || ' na UnB, cursando ' || v_semestre ||
          '. Prefiro explicações estruturadas com exemplos numéricos quando aplicável.',
        v_semestre,
        ARRAY[]::uuid[],
        1, v_n_sysprompts = 1,
        v_created_at + interval '10 minutes'
      );

      IF v_n_sysprompts = 2 THEN
        INSERT INTO public.user_system_prompts (
          user_id, prompt_text, semester_snapshot, source_documents, version, is_active, created_at
        ) VALUES (
          v_user_id,
          'Sou aluno(a) de ' || v_curso || ', semestre ' || v_semestre ||
            '. Foco em provas e listas. Use LaTeX para fórmulas.',
          v_semestre, ARRAY[]::uuid[],
          2, true,
          v_created_at + interval '15 days'
        );
      END IF;
    END IF;

    -- =========================================================================
    -- prompt_library privados (0-3 por user; ~30% cria)
    -- =========================================================================
    IF v_perfil_uso <> 'recem' AND random() < 0.30 THEN
      v_n_priv_prompts := 1 + floor(random() * 3)::int;  -- 1-3
      FOR j IN 1..v_n_priv_prompts LOOP
        v_idx := 1 + floor(random() * array_length(v_priv_prompt_titles, 1))::int;
        INSERT INTO public.prompt_library (
          user_id, title, description, template, category, is_official, usage_count, created_at
        ) VALUES (
          v_user_id,
          v_priv_prompt_titles[v_idx] || ' (' || v_curso || ')',
          'Prompt customizado para uso pessoal.',
          'Para {{materia}}, ' || lower(v_priv_prompt_titles[v_idx]) ||
            ' considerando o conteúdo de {{topico}}. Seja específico e use o material que processei.',
          v_priv_prompt_cats[v_idx]::prompt_category,
          false,
          floor(random() * 15)::int,
          v_created_at + (random() * interval '45 days')
        );
      END LOOP;
    END IF;

    -- =========================================================================
    -- documents + jobs + events + content + feedback
    -- =========================================================================
    v_n_docs := CASE v_perfil_uso
                  WHEN 'recem'  THEN 0
                  WHEN 'leve'   THEN 5  + floor(random() * 8)::int   -- 5-12
                  WHEN 'medio'  THEN 15 + floor(random() * 21)::int  -- 15-35
                  WHEN 'pesado' THEN 50 + floor(random() * 31)::int  -- 50-80
                END;

    FOR j IN 1..v_n_docs LOOP
      v_doc_id := gen_random_uuid();
      v_job_id := gen_random_uuid();

      -- format (65/20/10/3/2)
      v_rand := random();
      v_doc_format := CASE
        WHEN v_rand < 0.65 THEN 'pdf'
        WHEN v_rand < 0.85 THEN 'pptx'
        WHEN v_rand < 0.95 THEN 'docx'
        WHEN v_rand < 0.98 THEN 'image'
        ELSE 'md'
      END;

      -- tipo (60/10/8/6/4/4/4/4)
      v_rand := random();
      v_doc_tipo := CASE
        WHEN v_rand < 0.60 THEN 'Aula'
        WHEN v_rand < 0.70 THEN 'Lista'
        WHEN v_rand < 0.78 THEN 'Resumo'
        WHEN v_rand < 0.84 THEN 'Estudo Dirigido'
        WHEN v_rand < 0.88 THEN 'Plano'
        WHEN v_rand < 0.92 THEN 'Apostila'
        WHEN v_rand < 0.96 THEN 'Questionário'
        ELSE 'Outro'
      END;

      -- size by format (em bytes)
      v_doc_size := CASE v_doc_format
                      WHEN 'pdf'   THEN (500000  + random() * 3000000)::bigint
                      WHEN 'pptx'  THEN (2000000 + random() * 8000000)::bigint
                      WHEN 'docx'  THEN (100000  + random() * 800000)::bigint
                      WHEN 'image' THEN (200000  + random() * 2000000)::bigint
                      WHEN 'md'    THEN (5000    + random() * 80000)::bigint
                    END;

      -- materia: sortear das matérias do user
      IF jsonb_array_length(v_materias) > 0 THEN
        v_idx := floor(random() * jsonb_array_length(v_materias))::int;
        v_doc_materia_code := v_materias->v_idx->>'code';
        v_doc_materia_nome := v_materias->v_idx->>'nome';
      ELSE
        v_doc_materia_code := NULL;
        v_doc_materia_nome := 'Genérico';
      END IF;

      v_doc_created := v_created_at + (random() * (now() - v_created_at));
      v_doc_archived := CASE WHEN random() < 0.10
                             THEN v_doc_created + interval '20 days' + (random() * interval '60 days')
                             ELSE NULL END;

      -- nome do arquivo
      v_doc_filename_orig := CASE v_doc_tipo
        WHEN 'Aula'             THEN 'aula' || (1 + floor(random()*30))::int || '.' || v_doc_format
        WHEN 'Lista'            THEN 'lista' || (1 + floor(random()*10))::int || '.' || v_doc_format
        WHEN 'Resumo'           THEN 'resumo_' || lower(v_doc_materia_code) || '.' || v_doc_format
        WHEN 'Estudo Dirigido'  THEN 'ED_' || (1 + floor(random()*8))::int || '.' || v_doc_format
        WHEN 'Plano'            THEN 'plano_ensino.' || v_doc_format
        WHEN 'Apostila'         THEN 'apostila_' || lower(v_doc_materia_code) || '.' || v_doc_format
        WHEN 'Questionário'     THEN 'quest_' || (1 + floor(random()*10))::int || '.' || v_doc_format
        ELSE 'doc_' || (1 + floor(random()*100))::int || '.' || v_doc_format
      END;

      v_doc_identif := CASE WHEN v_doc_tipo IN ('Aula','Lista','Estudo Dirigido','Questionário')
                            THEN lpad((1 + floor(random()*15))::int::text, 2, '0')
                            ELSE NULL END;
      v_doc_titulo := v_doc_tipo || ' ' || COALESCE(v_doc_identif, '') || ' — ' || v_doc_materia_nome;
      v_doc_filename_final := COALESCE(v_doc_materia_code, 'GEN') || '-' || v_doc_tipo ||
                              CASE WHEN v_doc_identif IS NOT NULL THEN '-' || v_doc_identif ELSE '' END ||
                              '.' || v_doc_format;

      -- status do job (75/10/5/5/3/2)
      v_rand := random();
      v_job_status := CASE
        WHEN v_rand < 0.75 THEN 'completed'
        WHEN v_rand < 0.85 THEN 'completed_with_warning'
        WHEN v_rand < 0.90 THEN 'failed'
        WHEN v_rand < 0.95 THEN 'needs_review'
        WHEN v_rand < 0.98 THEN 'pending'
        ELSE 'processing'
      END;

      v_chars_input := (v_doc_size / 4)::int;
      v_chars_syn := (v_chars_input * (0.15 + random()*0.15))::int;
      v_chars_comp := (v_chars_syn * (0.30 + random()*0.20))::int;
      v_job_cost := round((v_chars_input / 1000000.0 * 0.5 + random()*0.005)::numeric, 6);
      v_job_started := v_doc_created + interval '5 seconds';
      v_job_attempt := CASE WHEN random() < 0.15 THEN 1 + floor(random()*2)::int ELSE 0 END;

      -- Ajustes por status
      CASE v_job_status
        WHEN 'completed' THEN
          v_job_step := 'compress'; v_job_progress := 100;
          v_job_completed := v_job_started + interval '60 seconds' + (random() * interval '120 seconds');
          v_job_error := NULL;
          v_doc_processed := v_job_completed;
          v_job_validation_score := round((0.75 + random()*0.20)::numeric, 2);
        WHEN 'completed_with_warning' THEN
          v_job_step := 'compress'; v_job_progress := 100;
          v_job_completed := v_job_started + interval '90 seconds' + (random() * interval '180 seconds');
          v_job_error := 'validation_score abaixo do alvo (' ||
                         round((0.55 + random()*0.10)::numeric, 2)::text || ' < 0.70)';
          v_doc_processed := v_job_completed;
          v_job_validation_score := round((0.55 + random()*0.10)::numeric, 2);
        WHEN 'failed' THEN
          v_job_step := (ARRAY['parse','classify','synthesize'])[1 + floor(random()*3)::int];
          v_job_progress := CASE v_job_step WHEN 'parse' THEN 10 WHEN 'classify' THEN 25 ELSE 60 END;
          v_job_completed := v_job_started + interval '8 seconds' + (random() * interval '20 seconds');
          v_job_error := (ARRAY[
            'parse_pdf: arquivo corrompido',
            'classify: LLM timeout após 30s',
            'synthesize: rate limit do provider',
            'OPENROUTER_API_KEY inválida',
            'parse_docx: estrutura XML inválida'])[1 + floor(random()*5)::int];
          v_doc_processed := NULL;
          v_chars_syn := NULL; v_chars_comp := NULL;
          v_job_validation_score := NULL;
        WHEN 'needs_review' THEN
          v_job_step := 'classify'; v_job_progress := 30;
          v_job_completed := v_job_started + interval '15 seconds' + (random() * interval '30 seconds');
          v_job_error := 'classificação com confiança baixa — usuário precisa confirmar matéria/tipo';
          v_doc_processed := NULL;
          v_chars_syn := NULL; v_chars_comp := NULL;
          v_job_validation_score := NULL;
        WHEN 'pending' THEN
          v_job_step := NULL; v_job_progress := 0;
          v_job_started := NULL; v_job_completed := NULL;
          v_job_error := NULL; v_chars_input := NULL; v_chars_syn := NULL; v_chars_comp := NULL;
          v_doc_processed := NULL;
          v_job_validation_score := NULL;
        WHEN 'processing' THEN
          v_job_step := (ARRAY['parse','classify','synthesize','compress'])[1 + floor(random()*4)::int];
          v_job_progress := 20 + floor(random()*60)::int;
          v_job_completed := NULL; v_job_error := NULL;
          v_chars_syn := NULL; v_chars_comp := NULL;
          v_doc_processed := NULL;
          v_job_validation_score := NULL;
      END CASE;

      -- INSERT document
      INSERT INTO public.documents (
        id, user_id, filename_original, filename_final, format, size_bytes, storage_path,
        materia_code, tipo, data_doc, identificador, titulo, classificacao_confianca,
        created_at, processed_at, archived_at
      ) VALUES (
        v_doc_id, v_user_id, v_doc_filename_orig,
        CASE WHEN v_job_status IN ('completed','completed_with_warning') THEN v_doc_filename_final ELSE NULL END,
        v_doc_format::document_format, v_doc_size,
        v_user_id::text || '/' || extract(epoch from v_doc_created)::bigint::text || '-' || v_doc_filename_orig,
        v_doc_materia_code,
        CASE WHEN v_job_status IN ('completed','completed_with_warning','needs_review')
             THEN v_doc_tipo::document_tipo ELSE NULL END,
        (v_doc_created::date) - (floor(random()*10))::int,
        v_doc_identif,
        CASE WHEN v_job_status IN ('completed','completed_with_warning') THEN v_doc_titulo ELSE NULL END,
        CASE WHEN v_job_status = 'completed' THEN round((0.85 + random()*0.13)::numeric, 2)
             WHEN v_job_status = 'completed_with_warning' THEN round((0.65 + random()*0.10)::numeric, 2)
             WHEN v_job_status = 'needs_review' THEN round((0.40 + random()*0.20)::numeric, 2)
             ELSE NULL END,
        v_doc_created, v_doc_processed, v_doc_archived
      );

      -- INSERT job
      INSERT INTO public.jobs (
        id, user_id, document_id, status, current_step, progress_percent, attempt_count,
        error_reason, chars_input, chars_synthesis, chars_compression, cost_usd_total,
        started_at, completed_at, created_at
      ) VALUES (
        v_job_id, v_user_id, v_doc_id, v_job_status::job_status, v_job_step, v_job_progress, v_job_attempt,
        v_job_error, v_chars_input, v_chars_syn, v_chars_comp,
        CASE WHEN v_job_status IN ('completed','completed_with_warning') THEN v_job_cost ELSE 0 END,
        v_job_started, v_job_completed, v_doc_created
      );

      -- =======================================================================
      -- job_events (varia por status)
      -- =======================================================================
      IF v_job_status IN ('completed','completed_with_warning') THEN
        -- 8 eventos: start+success de parse, classify, synthesize, compress
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'start', NULL, NULL, v_job_started);
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'success', v_chars_input || ' chars extraídos',
                  500 + floor(random()*2000)::int, v_job_started + interval '2 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'classify', 'start', NULL, NULL, 'openai/gpt-4o-mini', NULL, NULL, NULL, v_job_started + interval '3 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'classify', 'success',
                  'materia=' || COALESCE(v_doc_materia_code,'?') || ', tipo=' || v_doc_tipo,
                  600 + floor(random()*1000)::int, 'openai/gpt-4o-mini',
                  (v_chars_input/4)::int, 100 + floor(random()*200)::int,
                  round((random()*0.003)::numeric, 6), v_job_started + interval '5 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'synthesize', 'start', NULL, NULL, 'deepseek/deepseek-chat-v3', NULL, NULL, NULL, v_job_started + interval '6 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'synthesize', 'success', 'gerado ' || v_chars_syn || ' chars',
                  20000 + floor(random()*50000)::int, 'deepseek/deepseek-chat-v3',
                  (v_chars_input/4)::int, (v_chars_syn/4)::int,
                  round((v_job_cost*0.6)::numeric, 6), v_job_started + interval '40 seconds');
        IF v_job_status = 'completed_with_warning' THEN
          INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
            VALUES (v_job_id, 'judge', 'warning',
                    'validation_score=' || v_job_validation_score::text || ' abaixo de 0.70',
                    300 + floor(random()*500)::int, v_job_started + interval '50 seconds');
        END IF;
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'compress', 'start', NULL, NULL, 'google/gemini-2.0-flash-exp', NULL, NULL, NULL, v_job_started + interval '55 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'compress', 'success', '2 versões: compact + cola',
                  15000 + floor(random()*30000)::int, 'google/gemini-2.0-flash-exp',
                  (v_chars_syn/4)::int, (v_chars_comp/4)::int,
                  round((v_job_cost*0.3)::numeric, 6), v_job_completed);

        -- generated_content: 3 itens
        INSERT INTO public.generated_content (document_id, type, markdown, metadata, validation_score, created_at) VALUES
          (v_doc_id, 'synthesized',
           E'# ' || v_doc_titulo || E'\n\n## Conceitos centrais\n\nSíntese gerada automaticamente do documento ' ||
             v_doc_filename_orig || E'.\n\n## Tópicos cobertos\n\n- Tópico 1\n- Tópico 2\n- Tópico 3',
           jsonb_build_object('model','deepseek/deepseek-chat-v3','prompt_version','v2'),
           round((v_job_validation_score - 0.02)::numeric, 2),
           v_job_started + interval '40 seconds'),
          (v_doc_id, 'compressed_compact',
           E'## ' || v_doc_titulo || E' — Compacta\n\n- Ponto-chave 1\n- Ponto-chave 2\n- Fórmula relevante',
           jsonb_build_object('model','google/gemini-2.0-flash-exp'),
           round((v_job_validation_score - 0.04)::numeric, 2),
           v_job_completed),
          (v_doc_id, 'compressed_cola',
           '**' || v_doc_titulo || ':** versão cola ultra-curta.',
           jsonb_build_object('model','google/gemini-2.0-flash-exp'),
           round((v_job_validation_score - 0.06)::numeric, 2),
           v_job_completed);

        -- feedback: ~20% dos jobs completed/warning
        IF random() < 0.20 THEN
          INSERT INTO public.feedback (user_id, job_id, rating, topic, comments, created_at) VALUES (
            v_user_id, v_job_id,
            CASE WHEN random() < 0.05 THEN 1
                 WHEN random() < 0.15 THEN 2
                 WHEN random() < 0.40 THEN 3
                 WHEN random() < 0.75 THEN 4
                 ELSE 5 END,
            (ARRAY['sintese','nomenclatura','drive','prompts','outro'])[1 + floor(random()*5)::int]::feedback_topic,
            CASE WHEN random() < 0.5 THEN
              (ARRAY[
                'Síntese boa, mas faltou destaque pra fórmula principal.',
                'Achei muito útil, salvou meu tempo de revisão.',
                'A classificação errou a matéria, tive que corrigir manualmente.',
                'Excelente, vou usar pra todas as aulas.',
                'O nome do arquivo final ficou estranho.',
                'Cola muito curta, queria mais detalhe.',
                'Top, exatamente o que eu precisava.',
                NULL])[1 + floor(random()*8)::int]
              ELSE NULL END,
            v_job_completed + (random() * interval '5 days')
          );
        END IF;

      ELSIF v_job_status = 'failed' THEN
        -- 3-5 eventos antes de falhar
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'start', NULL, NULL, v_job_started);
        IF v_job_step IN ('classify','synthesize') THEN
          INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
            VALUES (v_job_id, 'parse', 'success', v_chars_input || ' chars extraídos', 800, v_job_started + interval '1 second');
        END IF;
        IF v_job_step = 'synthesize' THEN
          INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
            VALUES (v_job_id, 'classify', 'success', 'classificação ok', 700, v_job_started + interval '3 seconds');
        END IF;
        IF v_job_attempt > 0 THEN
          INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
            VALUES (v_job_id, v_job_step, 'retry', 'tentativa ' || v_job_attempt::text, 500, v_job_completed - interval '2 seconds');
        END IF;
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, v_job_step, 'error', v_job_error, NULL, v_job_completed);

      ELSIF v_job_status = 'needs_review' THEN
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'start', NULL, NULL, v_job_started);
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'success', v_chars_input || ' chars extraídos', 800, v_job_started + interval '1 second');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'classify', 'start', NULL, NULL, 'openai/gpt-4o-mini', NULL, NULL, NULL, v_job_started + interval '3 seconds');
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at)
          VALUES (v_job_id, 'classify', 'warning',
                  'baixa confiança na classificação — aguardando revisão',
                  900, 'openai/gpt-4o-mini', (v_chars_input/4)::int, 80,
                  round((random()*0.002)::numeric, 6), v_job_completed);

      ELSIF v_job_status = 'processing' THEN
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, 'parse', 'start', NULL, NULL, v_job_started);
        IF v_job_step IN ('classify','synthesize','compress') THEN
          INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
            VALUES (v_job_id, 'parse', 'success', '? chars extraídos', 900, v_job_started + interval '1 second');
        END IF;
        INSERT INTO public.job_events (job_id, step, event_type, message, duration_ms, created_at)
          VALUES (v_job_id, v_job_step, 'start', NULL, NULL, v_job_started + interval '5 seconds');
      END IF;
      -- (pending: nenhum evento)

    END LOOP; -- fim docs

    -- =========================================================================
    -- feedback geral (job_id NULL) — ~10% dos users dão um feedback geral
    -- =========================================================================
    IF v_perfil_uso <> 'recem' AND random() < 0.10 THEN
      INSERT INTO public.feedback (user_id, job_id, rating, topic, comments, created_at) VALUES (
        v_user_id, NULL,
        4 + floor(random()*2)::int,  -- 4-5 (feedback geral é mais positivo)
        'outro'::feedback_topic,
        (ARRAY[
          'App muito útil pra organizar o semestre.',
          'Adoraria ver suporte a vídeo-aulas.',
          'A interface tá bem fluida, parabéns.',
          'Conseguiriam adicionar tags personalizadas?'
        ])[1 + floor(random()*4)::int],
        v_created_at + interval '30 days' + (random() * interval '30 days')
      );
    END IF;

  END LOOP; -- fim profiles

  RAISE NOTICE 'Seed concluído: 50 profiles + cascata realista.';
END $seed$;
