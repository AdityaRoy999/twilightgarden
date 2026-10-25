import { useEffect, useState } from 'react';
import { localDateKey } from '../lib/dates';

export function useToday() {
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setToday(localDateKey());
      clearTimeout(timer);
      const midnight = new Date(); midnight.setHours(24,0,0,0);
      timer = setTimeout(update, midnight.getTime()-Date.now()+100);
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); window.removeEventListener('focus',update); document.removeEventListener('visibilitychange',update); };
  }, []);
  return today;
}
