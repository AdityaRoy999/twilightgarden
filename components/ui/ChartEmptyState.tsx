import React from 'react';
import { ReferenceArt } from './ReferenceArt';

export default function ChartEmptyState({ title = 'Your patterns start here', message = 'A few daily check-ins will help your patterns take shape.', onLog }: { title?: string; message?: string; onLog?: () => void }) {
  return <div className="bloom-empty"><ReferenceArt kind="clipboard"/><strong>{title}</strong><p>{message}</p>{onLog && <button onClick={onLog}>Log a check-in</button>}</div>;
}
