import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { normalizeError } from '../../utils/errorNormalizer';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[UNCAUGHT REACT ERROR]', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/home';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070F2C] text-white flex items-center justify-center p-4 font-sans selection:bg-[#F9C928]/30">
          <div className="bg-[#0B1536] border border-[#1E2E64] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">
                {this.props.fallbackTitle || 'Application Interface Notice'}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected view exception was caught. The application state has been preserved to protect your data.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left font-mono text-[11px] text-slate-300 overflow-x-auto max-h-28">
                {normalizeError(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 font-bold bg-[#1E5BD8] hover:bg-[#1A4FB8] text-white rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload Portal</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="py-2.5 px-4 font-semibold bg-[#112469] hover:bg-[#1E2E64] text-slate-200 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Home size={14} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
