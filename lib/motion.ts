import type { Transition } from 'framer-motion';

/** Natural period is a physical parameter, not Apple's perceptual duration. */
export function physicalSpring(period: number, dampingRatio: number, mass = 1) {
  if ([period, dampingRatio, mass].some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Spring parameters must be finite and positive');
  const omega = 2 * Math.PI / period;
  return { type: 'spring' as const, mass, stiffness: mass * omega ** 2, damping: 2 * mass * dampingRatio * omega, restSpeed: .08, restDelta: .002 };
}

export const springs = {
  message: physicalSpring(.31, .8),
  modal: physicalSpring(.34, .9),
  sheet: physicalSpring(.38, .92),
  section: physicalSpring(.32, 1),
  selection: physicalSpring(.3, .88),
};
export function motionTransition(spring: Transition, reduce: boolean): Transition { return reduce ? { duration: 0 } : spring; }

export type MessageStamp = { id: string; created_at: string };
/** Only newly appended messages animate: never initial hydration or older pages. */
export function newlyAppended(previous: readonly MessageStamp[], current: readonly MessageStamp[], ready: boolean) {
  if (!ready) return new Set<string>();
  if (!previous.length) return new Set(current.map(note => note.id));
  const ids = new Set(previous.map(note => note.id));
  const last = previous[previous.length - 1];
  return new Set(current.filter(note => !ids.has(note.id) && (note.created_at > last.created_at || (note.created_at === last.created_at && note.id > last.id))).map(note => note.id));
}
