import * as React from 'react';
import { StrictMode, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught React error caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '24px', 
          background: '#FFF0F0', 
          color: '#C00', 
          fontFamily: 'monospace', 
          margin: '24px', 
          borderRadius: '12px', 
          border: '2px solid #FFAAAA',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid #FFAAAA', paddingBottom: '8px' }}>
            Erro de Renderização do React (ErrorBoundary):
          </h2>
          <p style={{ fontSize: '15px', fontWeight: 'bold' }}>
            {this.state.error && this.state.error.toString()}
          </p>
          <div style={{ marginTop: '16px' }}>
            <strong>Caminho do Erro (Stack Trace):</strong>
            <pre style={{ 
              background: '#FFF', 
              padding: '12px', 
              borderRadius: '6px', 
              overflowX: 'auto', 
              fontSize: '11px', 
              color: '#333',
              border: '1px solid #EEE',
              marginTop: '6px'
            }}>
              {this.state.error?.stack}
            </pre>
          </div>
          {this.state.errorInfo && (
            <div style={{ marginTop: '16px' }}>
              <strong>Component Stack:</strong>
              <pre style={{ 
                background: '#FFF', 
                padding: '12px', 
                borderRadius: '6px', 
                overflowX: 'auto', 
                fontSize: '11px', 
                color: '#555',
                border: '1px solid #EEE',
                marginTop: '6px'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              marginTop: '16px',
              padding: '10px 16px',
              backgroundColor: '#C00',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            Limpar Cache/LocalStorage e Reiniciar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
