/**
 * Termos de Uso — projeto acadêmico PSP2.
 */

import { Link } from 'react-router-dom';
import UnbLogo from '../components/UnbLogo';
import { TOS_VERSION } from '../lib/consents';

export default function TermosPage() {
  return (
    <div className="container legal-page">
      <header className="legal-header">
        <UnbLogo size={36} />
        <Link to="/login" className="link">← Voltar</Link>
      </header>

      <article className="legal-content">
        <h1>Termos de Uso</h1>
        <p className="hint">
          Versão {TOS_VERSION} · Vigente desde 26 de maio de 2026.
        </p>

        <section>
          <h2>1. Sobre o serviço</h2>
          <p>
            PSP2 — IA para Universitários é um serviço acadêmico, sem fins
            lucrativos, oferecido pela equipe estudantil de PSP2 da UnB.
            O serviço processa documentos acadêmicos com modelos de IA
            generativa para auxiliar o estudo.
          </p>
        </section>

        <section>
          <h2>2. Aceite</h2>
          <p>
            Ao criar uma conta, você declara ter mais de 18 anos (ou possuir
            consentimento de responsável legal) e aceita estes termos e a{' '}
            <Link to="/privacidade">política de privacidade</Link>.
          </p>
        </section>

        <section>
          <h2>3. Uso aceitável</h2>
          <p>Você concorda em:</p>
          <ul>
            <li>Enviar apenas conteúdo do qual seja titular ou tenha autorização.</li>
            <li>Não enviar material com violação de direitos autorais, conteúdo ilegal, discurso de ódio ou pornográfico.</li>
            <li>Não usar o serviço para gerar conteúdo destinado a fraudar avaliações em desacordo com as regras da sua instituição.</li>
            <li>Não tentar fazer engenharia reversa, exceder limites técnicos ou comprometer a segurança do serviço.</li>
            <li>Respeitar as cotas de uso (rate limit) para preservar a disponibilidade para outros usuários.</li>
          </ul>
        </section>

        <section>
          <h2>4. Propriedade intelectual</h2>
          <p>
            Você mantém todos os direitos sobre os documentos que enviar.
            Concede ao PSP2 uma licença não-exclusiva, gratuita, limitada ao
            tempo de uso da conta, para processar, armazenar e gerar conteúdo
            derivado <strong>exclusivamente para você</strong>.
          </p>
          <p>
            O conteúdo gerado (sínteses, prompts) é seu — você pode usar,
            modificar e publicar livremente.
          </p>
        </section>

        <section>
          <h2>5. Limitações da IA</h2>
          <p>
            Os modelos de linguagem podem gerar respostas imprecisas, omitir
            informações ou inventar fatos (alucinação). Você é responsável por
            verificar a correção do conteúdo antes de usá-lo em avaliações ou
            decisões importantes.
          </p>
        </section>

        <section>
          <h2>6. Disponibilidade</h2>
          <p>
            O serviço é fornecido "no estado em que se encontra" (as-is). Não
            há SLA garantido. Manutenções podem ocorrer sem aviso prévio.
          </p>
        </section>

        <section>
          <h2>7. Limitação de responsabilidade</h2>
          <p>
            Por se tratar de projeto acadêmico gratuito, a equipe não se
            responsabiliza por: perdas de conteúdo, custos com terceiros
            (OpenRouter, Google), impacto em notas, indisponibilidades, ou
            decisões tomadas com base em conteúdo gerado.
          </p>
        </section>

        <section>
          <h2>8. Encerramento</h2>
          <p>
            Você pode encerrar a conta a qualquer momento em Configurações &gt;
            Privacidade &gt; Excluir conta. A equipe pode suspender contas que
            violem estes termos, com aviso quando possível.
          </p>
        </section>

        <section>
          <h2>9. Lei aplicável</h2>
          <p>
            Estes termos são regidos pela legislação brasileira, com foro na
            Comarca de Brasília — DF.
          </p>
        </section>

        <section>
          <h2>10. Alterações</h2>
          <p>
            Mudanças relevantes nestes termos serão comunicadas na aplicação.
            O uso continuado após a comunicação configura aceite tácito.
          </p>
        </section>
      </article>
    </div>
  );
}
