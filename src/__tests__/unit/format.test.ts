import { describe, it, expect } from 'vitest';
import { timeAgo, numFmt, fmtCap, stockColor, fmt } from '@/lib/format';

describe('fmt', () => {
  it('formats numbers with commas', () => {
    expect(fmt(1234567)).toBe('1,234,567');
    expect(fmt(0)).toBe('0');
    expect(fmt(999)).toBe('999');
  });
});

describe('numFmt', () => {
  it('formats small numbers as-is', () => {
    expect(numFmt(999)).toBe('999');
  });
  it('formats thousands with K', () => {
    expect(numFmt(1500)).toBe('1.5K');
    expect(numFmt(10000)).toBe('10.0K');
  });
});

describe('timeAgo', () => {
  it('returns 방금 전 for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('방금 전');
  });
  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5분 전');
  });
});

describe('fmtCap', () => {
  it('formats KRW market cap', () => {
    const result = fmtCap(348700000000000);
    expect(result).toBeTruthy();
  });
});

describe('stockColor', () => {
  it('returns color for positive change', () => {
    const color = stockColor(1.5, true);
    expect(color).toBeTruthy();
  });
  it('returns color for negative change', () => {
    const color = stockColor(-1.5, true);
    expect(color).toBeTruthy();
  });
});
