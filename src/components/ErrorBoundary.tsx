'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error('ErrorBoundary:', error); }
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
