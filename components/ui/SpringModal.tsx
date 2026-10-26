import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAppMotion } from '../../hooks/useAppMotion';
import { springs, motionTransition } from '../../lib/motion';
import { MotionPortal } from './MotionPortal';

function ModalPresence({ children, className, onClose, reduced }: { children: React.ReactNode; className: string; onClose?: () => void; reduced: boolean }) {
  const present = useIsPresent();
  return <motion.div aria-hidden={!present || undefined} inert={!present} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .14 }} onClick={onClose}>{children}</motion.div>;
}

export function SpringModal({ open, onClose, children, label, labelledBy, className = '', sheet = false }: { open: boolean; onClose?: () => void; children: React.ReactNode; label?: string; labelledBy?: string; className?: string; sheet?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const { reduced } = useAppMotion();
  useDialogFocus(panel, open);
  useEffect(() => {
    if (!open || !onClose) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open, onClose]);
  return <MotionPortal><AnimatePresence>{open && <ModalPresence className={`spring-modal-backdrop ${sheet ? 'is-sheet' : ''}`} onClose={onClose} reduced={reduced}>
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} tabIndex={-1} className={`spring-modal-panel ${className}`} initial={reduced ? false : { opacity: .6, y: sheet ? 48 : 20, scale: sheet ? 1 : .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: sheet ? 24 : 8, scale: .985 }} transition={motionTransition(sheet ? springs.sheet : springs.modal, reduced)} onClick={event => event.stopPropagation()}>{children}</motion.div>
  </ModalPresence>}</AnimatePresence></MotionPortal>;
}
