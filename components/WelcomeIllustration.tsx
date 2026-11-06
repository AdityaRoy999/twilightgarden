import React from 'react';

export type WelcomeScene = 'cycle' | 'care' | 'together' | 'vault';

/** Original painted artwork, served locally with alpha and reserved dimensions. */
export function WelcomeIllustration({ kind, className = '', priority = false }: {
  kind: WelcomeScene;
  className?: string;
  priority?: boolean;
}) {
  return <img className={`welcome-illustration ${className}`} data-welcome-scene={kind}
    src={`/illustrations/welcome-${kind}-v2.webp`} width={800} height={600}
    alt="" aria-hidden="true" draggable={false} decoding="async"
    fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'}/>;
}
