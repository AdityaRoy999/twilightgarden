import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { motionTransition, springs } from '../lib/motion';
import { WelcomeIllustration } from './WelcomeIllustration';
import { AppIcon } from './ui/Icons';

const features = [
  { kind: 'cycle', title: 'A little more in tune with you', description: 'Get to know your rhythm with thoughtful cycle tracking and simple daily check-ins.', note: 'Your body, understood', tags: ['Your cycle', 'Your pace'] },
  { kind: 'care', title: 'Make space for how you feel', description: 'Notice your moods, find gentle care ideas, and discover what helps you feel your best.', note: 'Little moments of care', tags: ['Daily check-ins', 'Personal insights'] },
  { kind: 'together', title: 'Feel closer, every day', description: 'Share what feels right and stay connected in a thoughtful space for the two of you.', note: 'Better, together', tags: ['Stay connected', 'Share with care'] },
] as const;

export function FeatureCarousel() {
  const [current, setCurrent] = useState(0);
  const { reduced } = useAppMotion();
  useEffect(() => {
    const next = features[current + 1];
    if (!next) return;
    const image = new Image();
    image.fetchPriority = 'low';
    image.src = `/illustrations/welcome-${next.kind}-v2.webp`;
  }, [current]);
  return <section className="welcome-features" aria-label="A little introduction to Twilight">
    <div className="welcome-cards">
      {features.map((feature, index) => <motion.article key={`${feature.kind}-${current === index ? 'current' : 'rest'}`} className="welcome-card" data-current={current === index}
        initial={reduced ? false : { opacity: .35, y: 12, scale: .985 }} animate={{opacity:1,y:0,scale:1}}
        transition={motionTransition(springs.onboarding,reduced)}>
        <div className={`welcome-art welcome-art-${feature.kind}`} aria-hidden="true"><WelcomeIllustration kind={feature.kind} priority={current === index}/><span>{feature.note}</span></div>
        <div className="welcome-card-copy"><h2>{feature.title}</h2><p>{feature.description}</p><div className="welcome-tags">{feature.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
      </motion.article>)}
    </div>
    <div className="welcome-pagination" aria-label="Introduction cards">
      <motion.button type="button" aria-label="Previous introduction" disabled={current === 0} onClick={() => setCurrent(value => value - 1)} whileTap={reduced ? undefined : {scale:.94}} transition={motionTransition(springs.selection,reduced)}><AppIcon name="chevron_left" size={21}/></motion.button>
      {features.map((feature, index) => <motion.button key={feature.kind} type="button" aria-label={`Show ${feature.title}`} aria-pressed={current === index} onClick={() => setCurrent(index)} whileTap={reduced ? undefined : { scale: .92 }} transition={motionTransition(springs.selection, reduced)}><span/></motion.button>)}
      <motion.button type="button" aria-label="Next introduction" disabled={current === features.length - 1} onClick={() => setCurrent(value => value + 1)} whileTap={reduced ? undefined : {scale:.94}} transition={motionTransition(springs.selection,reduced)}><AppIcon name="chevron_right" size={21}/></motion.button>
    </div>
  </section>;
}
