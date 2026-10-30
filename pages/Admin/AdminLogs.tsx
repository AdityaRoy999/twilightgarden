import React from 'react';
import {AppIcon} from '../../components/ui/Icons';
export default function AdminLogs(){
 return <main className="privacy-center"><section className="reference-card mx-auto max-w-xl p-8"><AppIcon name="lock" size={36}/><h1 className="mt-5 text-3xl font-bold">Private health history</h1><p className="mt-4 text-[var(--text-secondary)]">Health records are encrypted on each person's device. Administrators cannot read logs, dates, symptoms or notes. Only the owner and their explicitly authorized current partner can unlock shared records.</p></section></main>;
}