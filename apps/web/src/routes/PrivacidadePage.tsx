/**
 * Política de Privacidade — conformidade LGPD (Lei 13.709/2018).
 *
 * Conteúdo factual sobre dados coletados, finalidades, base legal,
 * compartilhamento (subprocessadores), retenção e direitos do titular.
 */

import { Link } from 'react-router-dom';
import UnbLogo from '../components/UnbLogo';
import { PRIVACY_VERSION } from '../lib/consents';

export default function PrivacidadePage() {
  return (
    <div className="container legal-page">
      <header className="legal-header">
        <UnbLogo size={36} />
        <Link to="/login" className="link">← Voltar</Link>
      </header>

      <article className="legal-content">
        <h1>Política de Privacidade</h1>
        <p className="hint">
          Versão {PRIVACY_VERSION} · Vigente desde 26 de maio de 2026.
        </p>

        <section>
          <h2>1. Quem somos</h2>
          <p>
            O PSP2 — IA para Universitários é um projeto acadêmico desenvolvido
            por alunos do curso de Engenharia da Universidade de Brasília (UnB),
            no âmbito da disciplina PSP2 (semestre 2026.1). O projeto não tem
            fins comerciais e é mantido pela equipe estudantil indicada no
            repositório público.
          </p>
        </section>

        <section>
          <h2>2. Dados que coletamos</h2>
          <ul>
            <li><strong>Conta:</strong> email, nome completo, senha (com hash).</li>
            <li><strong>Perfil acadêmico:</strong> curso, semestre, matérias e horários informados por você.</li>
            <li><strong>Documentos:</strong> PDFs, DOCX, PPTX, MD e imagens que você envia voluntariamente.</li>
            <li><strong>Conteúdo gerado:</strong> sínteses, compressões e prompts derivados dos seus documentos.</li>
            <li><strong>Telemetria de uso:</strong> registros (logs) de jobs de processamento, durações, modelos LLM utilizados, custo agregado por job.</li>
            <li><strong>Tokens OAuth do Google Drive:</strong> se você optar por conectar o Drive, armazenamos os tokens criptografados em repouso para fazer upload dos resultados na sua conta.</li>
            <li><strong>Metadados técnicos:</strong> user-agent e versão de termos aceitos no consentimento.</li>
          </ul>
        </section>

        <section>
          <h2>3. Finalidades</h2>
          <ul>
            <li>Operar o serviço (classificar, sintetizar e organizar seus documentos).</li>
            <li>Manter a conta e autenticação seguras.</li>
            <li>Gerar prompts personalizados ao seu semestre.</li>
            <li>Coletar métricas agregadas para pesquisa acadêmica (sem identificação pessoal nos resultados).</li>
            <li>Investigar incidentes técnicos e abuso.</li>
          </ul>
        </section>

        <section>
          <h2>4. Base legal (LGPD Art. 7º / 11)</h2>
          <p>
            Tratamos seus dados com base em:
          </p>
          <ul>
            <li><strong>Consentimento</strong> (Art. 7º, I) para criar conta e enviar documentos.</li>
            <li><strong>Execução de procedimento preliminar e contrato</strong> (Art. 7º, V) para entregar o serviço solicitado.</li>
            <li><strong>Legítimo interesse</strong> (Art. 7º, IX) para segurança, prevenção a fraudes e telemetria operacional.</li>
            <li><strong>Pesquisa</strong> (Art. 7º, IV) para fins acadêmicos da disciplina, sempre com dados anonimizados nos resultados publicados.</li>
          </ul>
        </section>

        <section>
          <h2>5. Compartilhamento (subprocessadores)</h2>
          <p>
            Para operar o serviço, compartilhamos dados estritamente necessários com:
          </p>
          <ul>
            <li><strong>Supabase Inc.</strong> (banco de dados, autenticação, storage) — servidores nos EUA.</li>
            <li><strong>Vercel Inc.</strong> (hospedagem do frontend) — servidores nos EUA.</li>
            <li><strong>OpenRouter</strong> (proxy de modelos LLM) — texto dos documentos é enviado para classificação e síntese.</li>
            <li><strong>Google LLC</strong> (Drive API) — apenas se você conectar voluntariamente; uploads vão direto pra sua conta.</li>
          </ul>
          <p>
            Esses serviços operam fora do Brasil. Aplicamos cláusulas-padrão e
            recursos técnicos (criptografia em trânsito e em repouso) para
            proteger a transferência (LGPD Art. 33).
          </p>
        </section>

        <section>
          <h2>6. Retenção</h2>
          <ul>
            <li>Documentos e sínteses: mantidos enquanto sua conta estiver ativa.</li>
            <li>Logs de jobs: 12 meses para auditoria operacional.</li>
            <li>Consentimentos: mantidos por todo o tempo de uso + 5 anos após encerramento (defesa em processo judicial — Art. 16, II).</li>
            <li>Tokens OAuth: revogados imediatamente se você desconectar o Drive.</li>
          </ul>
        </section>

        <section>
          <h2>7. Seus direitos (LGPD Art. 18)</h2>
          <p>
            Você pode, a qualquer momento, sem ônus:
          </p>
          <ul>
            <li><strong>Confirmar e acessar</strong> seus dados — em Configurações &gt; Privacidade.</li>
            <li><strong>Corrigir</strong> dados incompletos ou desatualizados — em Configurações.</li>
            <li><strong>Anonimizar, bloquear ou eliminar</strong> dados — em Configurações &gt; Privacidade &gt; Excluir conta.</li>
            <li><strong>Portar</strong> seus dados — exportação em JSON em Configurações &gt; Privacidade.</li>
            <li><strong>Revogar consentimento</strong> — basta excluir a conta. Não há reversão.</li>
            <li><strong>Informações sobre compartilhamento</strong> — disponíveis na seção 5.</li>
          </ul>
        </section>

        <section>
          <h2>8. Segurança</h2>
          <p>
            Aplicamos: hash de senhas, criptografia em trânsito (HTTPS), CSP,
            Row Level Security no banco, segregação por usuário no Storage,
            rate limiting, audit log de eventos de processamento e revisão
            periódica de dependências.
          </p>
        </section>

        <section>
          <h2>9. Cookies e localStorage</h2>
          <p>
            Usamos localStorage apenas para manter sua sessão autenticada
            (cookies funcionais). Não fazemos rastreamento publicitário e não
            há cookies de terceiros.
          </p>
        </section>

        <section>
          <h2>10. Contato e canal LGPD</h2>
          <p>
            Para exercer direitos ou esclarecer dúvidas, abra uma issue no
            repositório público do projeto ou contate a equipe responsável
            pela disciplina PSP2 da UnB.
          </p>
        </section>

        <section>
          <h2>11. Alterações</h2>
          <p>
            Esta política pode ser atualizada. A versão atual fica indicada
            no topo desta página. Mudanças relevantes serão comunicadas ao
            usuário ativo via aviso na aplicação.
          </p>
        </section>
      </article>
    </div>
  );
}
