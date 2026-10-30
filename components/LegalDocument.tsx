import React from 'react';
import {Link} from 'react-router-dom';
import {AppIcon} from './ui/Icons';
import {legalConfig,launchContactsReady} from '../lib/legalConfig';
export function LegalDocument({title,children}:{title:string;children:React.ReactNode}){
 return <main className="privacy-center safe-screen"><Link to="/privacy-controls" className="privacy-links"><AppIcon name="arrow_back"/>Privacy & safety</Link><h1>{title}</h1><p>Last updated 30 October 2026 · India testing release</p>
 {!launchContactsReady&&<aside className="privacy-launch-note">Launch setup incomplete: this test build has no configured public operator/service address and grievance contact. This notice is not a claim of legal certification or worldwide launch clearance.</aside>}
 {children}<section><h2>Operator & contact</h2><p>Operator: {legalConfig.operator||'Not configured'}<br/>Public service address: {legalConfig.address||'Not configured'}<br/>Support: {legalConfig.support||'Not configured'}<br/>Grievance officer: {legalConfig.grievanceName||'Not appointed/configured'}<br/>Grievance email: {legalConfig.grievanceEmail||'Not configured'}</p><Link className="reference-button secondary" to="/privacy-controls">Manage choices or record a request</Link></section></main>;
}
