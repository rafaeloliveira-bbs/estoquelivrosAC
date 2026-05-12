import { isAuthenticated } from '../utils/auth';
import './Footer.css';

const LOGO_SRC =
  'data:image/png;base64,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';

const LINKS = [
  {
    href: 'https://docs.google.com/forms/d/1GTwuIG3Y7cQ_laHtxFGo8k35Kv0znKoVehro18YHZZs/edit',
    label: 'Alterar formulário',
    desktop: 'footer-btn-blue',
    mobile: 'footer-mobile-btn-blue',
  },
  {
    href: 'https://docs.google.com/spreadsheets/d/1pCrag3SUFuxHGONKa1F4ct5BPds4SWYKnLjJRI1xi24/edit?gid=980151376#gid=980151376',
    label: 'Consultar Planilha',
    desktop: 'footer-btn-green',
    mobile: 'footer-mobile-btn-green',
  },
  {
    href: 'https://console.firebase.google.com/u/0/project/bot-suporte-sistemas/overview?hl=pt-br',
    label: 'Console Firebase',
    desktop: 'footer-btn-dark',
    mobile: 'footer-mobile-btn-red',
  },
];

export default function Footer() {
  if (!isAuthenticated()) return null;

  return (
    <footer className="app-footer">
      <div className="footer-stripe">
        <div className="stripe-yellow" />
        <div className="stripe-orange" />
        <div className="stripe-cyan" />
        <div className="stripe-purple" />
        <div className="stripe-green" />
      </div>

      {/* Desktop */}
      <div className="footer-desktop">
        <img alt="Bright Bee" src={LOGO_SRC} className="footer-logo-desktop" />
        <div className="footer-row">
          <p className="footer-desc">
            Sistema de chamados internos, facilitando<br />
            o monitoramento e a gestão de indicadores<br />
            chave de desempenho KPIs.
          </p>
          {LINKS.map(({ href, label, desktop }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className={`footer-btn ${desktop}`}>
              {label}
            </a>
          ))}
        </div>
        <div className="footer-divider" />
        <p className="footer-copyright">© 2026 Bright Bee School. Todos os direitos reservados.</p>
      </div>

      {/* Mobile */}
      <div className="footer-mobile">
        <img alt="Bright Bee" src={LOGO_SRC} className="footer-logo-mobile" />
        <div className="footer-mobile-links">
          {LINKS.map(({ href, label, mobile }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className={`footer-mobile-btn ${mobile}`}>
              {label}
            </a>
          ))}
        </div>
        <div className="footer-divider" />
        <p className="footer-copyright">© 2026 Bright Bee School. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
