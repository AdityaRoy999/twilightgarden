import React from 'react';
import { createPortal } from 'react-dom';

/** Dialogs live outside animated route transforms, in viewport coordinates. */
export function MotionPortal({ children }: { children: React.ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body);
}
