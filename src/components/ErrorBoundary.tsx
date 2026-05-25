"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Class-based Error Boundary.
 * Catches render / lifecycle errors in the subtree and shows a fallback UI
 * instead of crashing the entire page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to an error tracking service here.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 px-6 py-10 text-center space-y-3">
        <p className="text-2xl">⚠️</p>
        <p className="text-sm font-semibold text-red-300">
          Algo salió mal al mostrar esta sección
        </p>
        <p className="text-xs text-red-500 font-mono break-all max-w-md mx-auto">
          {error.message}
        </p>
        <button
          onClick={this.reset}
          className="mt-2 rounded-lg border border-red-700 px-4 py-1.5 text-xs text-red-300 hover:text-white hover:border-red-500 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
