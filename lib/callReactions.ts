export const callReactionNames = ['heart', 'laugh', 'clap', 'celebrate', 'wave', 'kiss'] as const;
export type CallReactionName = typeof callReactionNames[number];
export type CallReaction = { id: string; name: CallReactionName; mine: boolean; at: number };
export function isCallReaction(value: unknown): value is CallReactionName {
  return typeof value === 'string' && (callReactionNames as readonly string[]).includes(value);
}
export function appendCallReaction(previous: CallReaction[], next: CallReaction): CallReaction[] {
  return [...previous.filter(item => next.at - item.at < 3500 && item.id !== next.id).slice(-7), next];
}
