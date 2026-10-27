import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppIcon } from '../ui/Icons';
import { WellnessIllustration } from './WellnessIllustration';
import { getWellnessIllustration, parseWellnessGuide } from '../../lib/wellnessGuide';
import { useAppMotion } from '../../hooks/useAppMotion';
import { springs, motionTransition } from '../../lib/motion';

export function IllustratedGuide({ text, partner = false, onRefresh, busy = false }: { text: string; partner?: boolean; onRefresh: () => void; busy?: boolean }) {
  const cards = useMemo(() => parseWellnessGuide(text), [text]);
  const { reduced } = useAppMotion();
  return <section className={`illustrated-guide ${partner ? 'is-care-guide' : ''}`} aria-busy={busy}>
    <header className="guide-heading"><span className="guide-heading-symbol"><AppIcon name={partner ? 'favorite' : 'auto_awesome'} size={32}/></span><div><h2>{partner ? 'Partner Care Guide' : 'Your Personalized Tips'}</h2><p>{partner ? 'Simple ways to be there for each other, at your own pace.' : 'Thoughtful suggestions for your current phase, to help you feel your best.'}</p></div><motion.button className="guide-refresh" onClick={onRefresh} disabled={busy} whileTap={reduced || busy ? undefined : { scale: .96 }} transition={motionTransition(springs.selection, reduced)}><AppIcon name="refresh" size={20}/>{busy ? 'Refreshing…' : 'Refresh'}</motion.button></header>
    {cards.length ? <div className="guide-cards">{cards.map((card, index) => {
      const art = getWellnessIllustration(card.illustrationId);
      return <article className={`illustrated-tip tone-${art.tone}`} key={`${card.title}-${index}`}>
        <div className="tip-copy"><div className="tip-title"><span className="tip-symbol"><AppIcon name={art.icon} size={27}/></span><div><h3>{card.title}</h3>{card.caption ? <span className="tip-caption">{card.caption}</span> : null}</div></div><p className="tip-body">{card.body}</p>{card.quote ? <blockquote><AppIcon name="format_quote" size={24}/><div><small>A caring way to say it</small><p>“{card.quote}”</p></div></blockquote> : null}</div>
        <div className="tip-visual"><WellnessIllustration id={art.id} eager={index === 0}/>{card.actions.length ? <ul>{card.actions.map(action => <li key={action}><AppIcon name="check_circle" size={16}/><span>{action}</span></li>)}</ul> : null}</div>
      </article>;
    })}</div> : <div className="guide-empty" role="status"><WellnessIllustration id={partner ? 'supportive-couple' : 'general-care'}/><p>{text ? 'We couldn’t read this guide. Refresh to try again.' : 'Your personalized guidance will appear here.'}</p></div>}
    <p className="guide-footnote">Gentle suggestions, shaped by what you’ve logged. Choose what feels right for you.</p>
  </section>;
}
