'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

function isNextControlError(error: any): boolean {
  // notFound() / redirect() throw special errors with a digest like
  // "NEXT_NOT_FOUND", "NEXT_REDIRECT;...", "NEXT_HTTP_ERROR_FALLBACK;404".
  // These must propagate to the framework so the proper 404/redirect status fires —
  // otherwise this boundary swallows them and the page returns 200 (soft 404).
  return typeof error?.digest === 'string' && error.digest.startsWith('NEXT_');
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) {
    if (isNextControlError(error)) throw error;
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    if (isNextControlError(error)) throw error;
    console.error('ErrorBoundary:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? (
      <div style={{ textAlign:'center', padding:'60px 20px' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h2 style={{ color:'var(--text-primary)', margin:'0 0 8px' }}>문제가 발생했습니다</h2>
        <p style={{ color:'var(--text-secondary)', marginBottom:24 }}>{this.state.error?.message}</p>
        <button onClick={() => this.setState({ hasError: false })} style={{
          background:'var(--brand)', color:'var(--text-inverse)', border:'none',
          borderRadius: 'var(--radius-xl)', padding:'10px 24px', cursor:'pointer', fontWeight:700
        }}>다시 시도</button>
      </div>
    );
    return this.props.children;
  }
}
