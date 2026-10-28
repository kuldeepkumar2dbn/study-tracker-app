import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Robust React Error Boundary Component
 * Catches render/runtime errors in child components and renders a graceful recovery card
 * preventing blank black screen crashes on mobile or desktop devices.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('StudyFlow ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/index.html';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          id="error-boundary-fallback"
          className="min-h-[420px] w-full flex items-center justify-center p-4 sm:p-6 my-auto"
        >
          <div className="w-full max-w-lg rounded-3xl p-6 sm:p-8 glass-panel border border-rose-500/30 shadow-2xl bg-theme-surface/90 text-center backdrop-blur-xl animate-fadeIn">
            {/* Warning Icon with Glow */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500/20 via-amber-500/20 to-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 text-rose-400 shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            {/* Error Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
              <span>View Recovery Mode</span>
            </div>

            {/* Headline */}
            <h2 className="font-display font-extrabold text-2xl text-theme-text tracking-tight mb-2">
              Something went wrong
            </h2>

            {/* Description */}
            <p className="text-xs sm:text-sm text-theme-muted max-w-md mx-auto mb-6 leading-relaxed">
              An unexpected error interrupted this view. Your study data and syllabus progress remain safely saved on your device and in Google Drive.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white font-semibold text-xs shadow-glow-accent transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text font-semibold text-xs transition-all cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
            </div>

            {/* Collapsible Error Details for debugging */}
            {this.state.error && (
              <details className="mt-6 text-left border-t border-theme-border/60 pt-4">
                <summary className="text-[11px] font-mono text-theme-muted hover:text-theme-text cursor-pointer select-none">
                  Technical error details
                </summary>
                <pre className="mt-2 p-3 rounded-xl bg-black/40 text-[10px] font-mono text-rose-300 overflow-x-auto max-h-36 whitespace-pre-wrap break-words border border-rose-500/20">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
