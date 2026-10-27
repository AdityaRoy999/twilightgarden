import React from 'react';
import { Link } from 'react-router-dom';
import { FeatureCarousel } from '../components/FeatureCarousel';
import { ArrowRight, Flower2, Heart } from '../components/ui/Icons';

export default function Welcome() {
  return (
    <main className="reference-welcome welcome-screen safe-screen">
      <header className="welcome-brand"><Flower2 size={27} aria-hidden="true"/><h1>Twilight Garden</h1></header>
      <FeatureCarousel />
      <nav className="welcome-actions" aria-label="Choose your space">
        <Link to="/login" className="welcome-action on-brand"><Flower2 size={21} aria-hidden="true"/><span>Track My Cycle</span><ArrowRight size={20} aria-hidden="true"/></Link>
        <Link to="/partner/login" className="welcome-action welcome-partner"><Heart size={21} aria-hidden="true"/><span>Join as Partner</span><ArrowRight size={20} aria-hidden="true"/></Link>
      </nav>
      <p className="welcome-footnote">Your rhythm. Your pace. A little closer, every day.</p>
    </main>
  );
}
