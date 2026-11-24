import { useCallback, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useDataState } from '../data/DataProvider';
import { ErrorBoundary } from './Feedback';
import { AiAssistant } from './AiAssistant';

const APP_NAME = 'AI Travel Route Planner';
const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

export function Layout() {
  const { state } = useDataState();
  const [aiOpen, setAiOpen] = useState(false);
  const closeAi = useCallback(() => setAiOpen(false), []);
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="brand" aria-label={`${APP_NAME} home`}>
            <img className="brand__mark" src={LOGO_SRC} alt="" width={34} height={34} />
            <span className="brand__name">{APP_NAME}</span>
          </Link>
          <div className="topbar__actions">
            {state.status === 'ready' && (
              <span className="topbar__stats">
                {state.data.dataset.stats.places} places · {state.data.dataset.stats.destinations} cities
              </span>
            )}
            <button type="button" className="btn ai-launch" onClick={() => setAiOpen(true)} aria-expanded={aiOpen} aria-haspopup="dialog">
              <Sparkles size={16} aria-hidden /> <span>Ask Reitti AI</span>
            </button>
          </div>
        </div>
      </header>
      <AiAssistant open={aiOpen} onClose={closeAi} data={state.status === 'ready' ? state.data : null} />
      <main id="main" className="main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <div className="container footer__inner">
          <Link to="/" className="footer__brand">
            <img className="footer__logo" src={LOGO_SRC} alt="" width={20} height={20} />
            {APP_NAME}
          </Link>
          <p className="footer__note">Prices and opening times are estimates. Check with the venue before you go.</p>
          <p className="footer__copy">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}
