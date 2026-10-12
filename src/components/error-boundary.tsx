"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: (error: Error, reset: () => void) => ReactNode; children: ReactNode };
type State = { error: Error | null };

/**
 * Keeps a failing widget (a viewer, a chart) from taking the whole page
 * down. React only catches render-time errors this way, so viewers that
 * run imperative code should still guard their own setup.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Viewer failed:", error);
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, () => this.setState({ error: null }));
    return this.props.children;
  }
}
