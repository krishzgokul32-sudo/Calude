import { Component } from 'react';
import { reportClientError } from '../lib/api';

/**
 * Catches render errors so one broken component shows a friendly screen instead of a blank white page
 * (guide §06). A failed lazy chunk usually means a new version was deployed: reload once to fetch it.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const chunkFailed = /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(error?.message || '');
    if (chunkFailed) {
      try {
        if (!sessionStorage.getItem('gk_chunk_reload')) {
          sessionStorage.setItem('gk_chunk_reload', '1');
          location.reload();
          return;
        }
      } catch {
        /* storage unavailable */
      }
    }
    reportClientError(error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="glass card" style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🛠️</div>
          <h2 style={{ margin: '8px 0' }}>Something went wrong</h2>
          <p className="muted small" style={{ marginBottom: 16 }}>This screen hit an error. Your data is safe. Reloading usually fixes it.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              try {
                sessionStorage.removeItem('gk_chunk_reload');
              } catch {
                /* ignore */
              }
              location.reload();
            }}
          >
            Reload GK
          </button>
        </div>
      </div>
    );
  }
}
