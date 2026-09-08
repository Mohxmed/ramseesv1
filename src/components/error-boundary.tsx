"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorBox } from "@/components/ui/status-cards";

interface Props {
  children: ReactNode;
  message?: string;
  /** When this value changes, an active error resets (e.g. on route change). */
  resetKey?: string | number;
}

interface State {
  error: Error | null;
}

/**
 * Component-level error boundary — a crashing panel never kills the app.
 * Usage: wrap page/main children in the dashboard layout.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[error-boundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorBox
          message={
            this.state.error.message || this.props.message || "حدث خطأ غير متوقع."
          }
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}