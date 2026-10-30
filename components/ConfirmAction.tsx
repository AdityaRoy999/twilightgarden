import React from 'react';
import { SpringModal } from './ui/SpringModal';
import { AppIcon } from './ui/Icons';

export function ConfirmAction({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const disconnect = confirmLabel === 'Disconnect';
  return <SpringModal open onClose={onCancel} label={title} className="confirm-action">
    <div className="confirm-action-art" aria-hidden="true">
      {disconnect ? <svg viewBox="0 0 180 108" fill="none">
        <circle cx="90" cy="54" r="49" fill="var(--bloom-tint)"/>
        <g stroke="var(--color-primary)" strokeWidth="9" strokeLinecap="round">
          <path d="M68 39 56 51a17 17 0 0 0 24 24l10-10M112 69l12-12a17 17 0 0 0-24-24L90 43"/>
          <path d="m77 50 8-8m10 24 8-8" strokeWidth="5"/>
        </g>
        <path d="m82 24 4 9m20 49 4 9m-53-5 8-4m53-58 8-4" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round"/>
      </svg> : <AppIcon name="delete" size={48}/>}
    </div>
    <h2>{title}</h2><p>{message}</p>
    <div className="confirm-action-buttons"><button autoFocus onClick={onCancel}>{cancelLabel}</button><button className="confirm-action-destructive" onClick={onConfirm}>{confirmLabel}</button></div>
  </SpringModal>;
}
