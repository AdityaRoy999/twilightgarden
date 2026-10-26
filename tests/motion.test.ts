import { describe, expect, it } from 'vitest';
import { motionTransition, newlyAppended, physicalSpring, springs } from '../lib/motion';

const stamp = (id: string, minute: number) => ({ id, created_at: `2026-10-26T10:${String(minute).padStart(2, '0')}:00Z` });

describe('physical interface motion', () => {
  it('derives a critically damped spring independent of mass', () => {
    for (const mass of [1, 3]) {
      const { stiffness, damping } = physicalSpring(.32, 1, mass);
      expect(damping ** 2 / (4 * mass * stiffness)).toBeCloseTo(1);
      expect(2 * Math.PI * Math.sqrt(mass / stiffness)).toBeCloseTo(.32);
    }
    expect(springs.message.damping ** 2 / (4 * springs.message.mass * springs.message.stiffness)).toBeGreaterThan(.6);
  });
  it('rejects parameters which cannot settle and removes movement for reduced motion', () => {
    for (const value of [0, -1, NaN, Infinity]) expect(() => physicalSpring(value, .9)).toThrow();
    expect(motionTransition(springs.modal, true)).toEqual({ duration: 0 });
  });
});

describe('message arrival classification', () => {
  it('keeps initial hydration, receipts, decryption, and older history still', () => {
    const current = [stamp('a', 4), stamp('b', 5)];
    expect(newlyAppended([], current, false).size).toBe(0);
    expect(newlyAppended(current, [...current], true).size).toBe(0);
    expect(newlyAppended(current, [stamp('older', 1), ...current], true).size).toBe(0);
  });
  it('animates the first live message and only later arrivals during mixed history updates', () => {
    expect([...newlyAppended([], [stamp('first', 1)], true)]).toEqual(['first']);
    const previous = [stamp('a', 4), stamp('b', 5)];
    expect([...newlyAppended(previous, [stamp('older', 1), ...previous, stamp('c', 6)], true)]).toEqual(['c']);
  });
});
