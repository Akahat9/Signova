import React from 'react';
import { reportClientError } from '../services/clientErrorReporter';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    void reportClientError(error, {
      source: 'react_boundary',
      componentStack: info?.componentStack || '',
    });
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <main className="appCrashFallback" role="alert" aria-live="assertive">
        <div>
          <span aria-hidden="true">!</span>
          <h1>Signova needs to restart this view</h1>
          <p>Your account data is safe. Reload the app to continue.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Signova</button>
        </div>
      </main>
    );
  }
}
