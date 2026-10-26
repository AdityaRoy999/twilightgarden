import React, { useState } from 'react';
import { Check, HeartHandshake, Flower2, Sparkles } from 'lucide-react';
import { BotanicalSprig, CycleBloom } from './ui/CycleBloom';

const features = [
  { title: 'A little more in tune with you', description: 'Get to know your rhythm with thoughtful cycle tracking and simple daily check-ins.', tags: ['Your cycle', 'Your pace'], Icon: Flower2 },
  { title: 'Make space for how you feel', description: 'From restful nights to changing moods, the little things tell your story.', tags: ['Daily check-ins', 'Personal insights'], Icon: Sparkles },
  { title: 'Feel closer, every day', description: 'Share the moments that matter with your partner, in a space made for the two of you.', tags: ['Stay connected', 'Share with care'], Icon: HeartHandshake },
];

export function FeatureCarousel() {
  const [current, setCurrent] = useState(0);
  const feature = features[current];
  const Icon = feature.Icon;
  return <div className="bloom-welcome-feature">
    <div className="bloom-welcome-art" aria-hidden="true"><span className="bloom-welcome-badge"><Icon size={26}/></span><BotanicalSprig className="bloom-welcome-sprig"/><div className="bloom-welcome-ring"><CycleBloom day={25} length={28}/></div><span className="bloom-welcome-note">A space to bloom.</span></div>
    <div key={feature.title} className="bloom-feature-copy"><h1>{feature.title}</h1><p>{feature.description}</p><div className="bloom-feature-tags">{feature.tags.map(tag => <span key={tag}><Check size={14}/>{tag}</span>)}</div></div>
    <div className="bloom-carousel-dots">{features.map((item, index) => <button key={item.title} aria-label={`Show ${item.title}`} aria-pressed={current === index} onClick={() => setCurrent(index)}><span/></button>)}</div>
  </div>;
}
