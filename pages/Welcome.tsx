import React from 'react';
import { Link } from 'react-router-dom';
import { FeatureCarousel } from '../components/FeatureCarousel';
import { ArrowRight, Flower2, Heart } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { motionTransition, springs } from '../lib/motion';
const MotionLink = motion.create(Link);

export default function Welcome() {
  const { reduced } = useAppMotion();
  return (
    <main className="reference-welcome welcome-screen safe-screen">
      <header className="welcome-brand"><Flower2 size={27} aria-hidden="true"/><h1>Twilight Garden</h1></header>
      <p className="welcome-kicker">A little care. A little closer.</p>
      <FeatureCarousel />
      <nav className="welcome-actions" aria-label="Choose your space">
        <MotionLink to="/login" className="welcome-action on-brand" whileTap={reduced ? undefined : {scale:.98}} transition={motionTransition(springs.selection,reduced)}><Flower2 size={21} aria-hidden="true"/><span>Track My Cycle</span><ArrowRight size={20} aria-hidden="true"/></MotionLink>
        <MotionLink to="/partner/login" className="welcome-action welcome-partner" whileTap={reduced ? undefined : {scale:.98}} transition={motionTransition(springs.selection,reduced)}><Heart size={21} aria-hidden="true"/><span>Join as Partner</span><ArrowRight size={20} aria-hidden="true"/></MotionLink>
      </nav>
      <p className="welcome-footnote">Your rhythm. Your pace. A little closer, every day.</p>
    </main>
  );
}
