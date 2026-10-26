import React from 'react';
import { ChartNoAxesCombined } from 'lucide-react';

export default function ChartEmptyState({ title = 'Your patterns start here', message = 'A few daily check-ins will help your patterns take shape.', onLog }: { title?: string; message?: string; onLog?: () => void }) {
  return <div className="bloom-empty"><span className="bloom-icon lavender"><ChartNoAxesCombined size={25}/></span><strong>{title}</strong><p>{message}</p>{onLog && <button onClick={onLog}>Log a check-in</button>}</div>;
}
