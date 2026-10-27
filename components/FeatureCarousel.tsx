import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { motionTransition, springs } from '../lib/motion';
import { WelcomeIllustration } from './WelcomeIllustration';

const features = [
  { kind: 'cycle', title: 'A little more in tune with you', description: 'Get to know your rhythm with thoughtful cycle tracking and simple daily check-ins.', note: 'Your body, understood', tags: ['Your cycle', 'Your pace'] },
  { kind: 'care', title: 'Make space for how you feel', description: 'Notice your moods, find gentle care ideas, and discover what helps you feel your best.', note: 'Little moments of care', tags: ['Daily check-ins', 'Personal insights'] },
  { kind: 'together', title: 'Feel closer, every day', description: 'Share what feels right and stay connected in a thoughtful space for the two of you.', note: 'Better, together', tags: ['Stay connected', 'Share with care'] },
] as const;

export function FeatureCarousel() {
  const [current, setCurrent] = useState(0);
  const { reduced } = useAppMotion();
  return <section className="welcome-features" aria-label="A little introduction to Twilight">
    <div className="welcome-cards">
      {features.map((feature, index) => <article key={feature.kind} className="welcome-card" data-current={current === index}>
        <div className={`welcome-art welcome-art-${feature.kind}`} aria-hidden="true"><WelcomeIllustration kind={feature.kind}/><span>{feature.note}</span></div>
        <div className="welcome-card-copy"><h2>{feature.title}</h2><p>{feature.description}</p><div className="welcome-tags">{feature.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
      </article>)}
    </div>
    <div className="welcome-pagination" aria-label="Introduction cards">
      {features.map((feature, index) => <motion.button key={feature.kind} type="button" aria-label={`Show ${feature.title}`} aria-pressed={current === index} onClick={() => setCurrent(index)} whileTap={reduced ? undefined : { scale: .92 }} transition={motionTransition(springs.selection, reduced)}><span/></motion.button>)}
    </div>
  </section>;
}
