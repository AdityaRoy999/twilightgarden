import React from 'react';
import {isChunkLoadError} from '../lib/chunkRecovery';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    if(isChunkLoadError(this.state.error?.message||'')){window.location.reload();return;}
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl text-red-500">error</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="on-brand px-6 py-2.5 bg-primary text-white rounded-full font-semibold text-sm hover:bg-[#7a3554] transition-colors"
          >
            {isChunkLoadError(this.state.error?.message||'')?'Reload app':'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
