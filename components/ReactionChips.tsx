import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { motionTransition, springs } from '../lib/motion';

export function ReactionChips({ reactions, userId, onReact }: { reactions: { emoji: string; user_id: string }[] | null | undefined; userId?: string; onReact: (emoji: string) => void }) {
  const { reduced } = useAppMotion();
  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of Array.isArray(reactions) ? reactions : []) {
    const group = groups.get(reaction.emoji) || { count: 0, mine: false };
    group.count++; group.mine ||= reaction.user_id === userId; groups.set(reaction.emoji, group);
  }
  return <AnimatePresence initial={false}>{[...groups].map(([emoji, { count, mine }]) => <motion.button
    key={emoji} type="button" className="reaction-chip" aria-label={`${emoji}, ${count} reaction${count === 1 ? '' : 's'}${mine ? ', including yours' : ''}`} aria-pressed={mine}
    initial={reduced ? false : { scale: .45, y: 7 }} animate={{ scale: 1, y: 0 }} exit={reduced ? undefined : { scale: .4, opacity: 0 }} layout="position"
    transition={motionTransition(springs.message, reduced)} onClick={event => { event.stopPropagation(); onReact(emoji); }}>
    <AnimatePresence initial={false} mode="popLayout"><motion.span key={`${count}:${mine}`} initial={reduced ? false : { scale: .6, y: 3 }} animate={{ scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={motionTransition(springs.selection, reduced)}>{emoji}</motion.span></AnimatePresence>
    {count > 1 && <span className="reaction-count">{count}</span>}
  </motion.button>)}</AnimatePresence>;
}
