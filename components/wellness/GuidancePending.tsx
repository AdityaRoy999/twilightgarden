import React from 'react';
import {AppIcon} from '../ui/Icons';

export const waitingQuotes = ['You can take today one small step at a time.','Rest is a part of caring for yourself.','A little kindness can make room for a softer day.'];
export const caregiverWaitingQuotes = ['Ask what would help your partner today; let their answer guide you.','Offer to take one task off their plate, without pressure.','Listen first. Your partner can choose company, practical help or space.'];
export function GenerationStatus(){return <span className="generation-status"><span className="generation-dots" aria-hidden="true"><i/><i/><i/></span>Preparing your AI guide…</span>;}
export function GuidancePending({partner=false}: {partner?:boolean}) {
  return <section className="illustrated-guide guidance-pending" role="status" aria-live="polite" aria-busy="true"><header className="guide-heading"><div><h2>{partner?'A little care, together':'A moment for yourself'}</h2><GenerationStatus/><p>{partner?'Preparing ways you can support your partner from their shared check-ins.':'You can keep exploring while we use your available check-ins.'}</p></div></header><p className="guidance-pending-label">A few words while you wait · these are prepared quotes</p><div className="guide-cards">{(partner?caregiverWaitingQuotes:waitingQuotes).map((quote,index)=><article key={quote}><AppIcon name={['favorite','bedtime','spa'][index]} size={25}/><p>“{quote}”</p></article>)}</div></section>;
}
