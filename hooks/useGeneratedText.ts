import { useCallback, useEffect, useRef, useState } from 'react';
import {withinDeadline} from '../lib/requestTimeout';

type Result = { text: string; error?: string };
type Entry = Result & { status: 'loading' | 'ready' | 'error' };
/** In-memory, view-scoped requests: no cross-account persistence or stale writes. */
export function useGeneratedText<K extends string>(generators: Record<K, (refresh?:boolean) => Promise<Result>>, scope: string) {
  const current = useRef(generators); current.current = generators;
  const generation = useRef(scope); generation.current = scope;
  const mounted = useRef(true);
  const pending = useRef(new Map<string, Promise<void>>());
  const [cache, setCache] = useState<{ scope: string; entries: Partial<Record<K, Entry>> }>({ scope, entries: {} });
  const entries: Partial<Record<K, Entry>> = cache.scope === scope ? cache.entries : {};
  const entriesRef = useRef(entries); entriesRef.current = entries;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const request = useCallback((key: K, refresh = false) => {
    const id = scope + ':' + key;
    if (pending.current.has(id)) return pending.current.get(id)!;
    if (!refresh && entriesRef.current[key]?.status === 'ready') return Promise.resolve();
    const write = (entry: Entry) => {
      if (mounted.current && generation.current === scope) setCache(previous => ({ scope, entries: { ...(previous.scope === scope ? previous.entries : {}), [key]: entry } }));
    };
    write({ status: 'loading', text: entriesRef.current[key]?.text || '' });
    const generate = current.current[key];
    const job = (async () => {
      try {
        const result = await withinDeadline(()=>generate(refresh),40000,'Your AI guide is taking too long. Please try again.');
        if (result.error || typeof result.text !== 'string' || !result.text.trim()) throw new Error(result.error || 'No guidance was returned. Please retry.');
        write({ status: 'ready', text: result.text });
      } catch (error) {
        write({ status: 'error', text: '', error: error instanceof Error ? error.message : 'Could not load guidance. Please retry.' });
      } finally { pending.current.delete(id); }
    })();
    pending.current.set(id, job);
    return job;
  }, [scope]);
  return { entries, request };
}
