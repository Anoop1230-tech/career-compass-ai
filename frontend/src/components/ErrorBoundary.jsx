import { Component } from "react";

/**
 * Catches render errors in the page below it so one broken page
 * shows a friendly message instead of a blank white screen.
 * Reset it by changing its `key` (we use the current URL).
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Later phases can send this to a logging service
    console.error("Page crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Something went wrong</h1>
          <p className="muted">This page hit an unexpected error. Your data is safe.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a href="/" className="btn btn--secondary">
              Go home
            </a>
          </div>
        </div>
      </section>
    );
  }
}
