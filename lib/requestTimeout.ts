/** Bound the whole operation, including session/storage waits before fetch starts.
 * Callers still guard stale results; abort is also forwarded to cancellable IO. */
export async function withinDeadline<T>(work: (signal: AbortSignal) => PromiseLike<T> | T, milliseconds: number, message: string, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  const stop = new Promise<never>((_, reject) => {
    onAbort = () => { controller.abort(); reject(new DOMException('Request cancelled', 'AbortError')); };
    if (parent?.aborted) onAbort(); else parent?.addEventListener('abort', onAbort, {once:true});
    timer = setTimeout(() => { controller.abort(); const error = new Error(message); error.name = 'TimeoutError'; reject(error); }, milliseconds);
  });
  try { return await Promise.race([stop, Promise.resolve().then(() => { controller.signal.throwIfAborted(); return work(controller.signal); })]); }
  finally { clearTimeout(timer!); parent?.removeEventListener('abort', onAbort!); controller.abort(); }
}

export function requestError(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim() ? error.message : fallback;
}

export async function retryTransientRead<T>(read: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  for (let attempt=0;;attempt++) {
    signal.throwIfAborted();
    try { return await read(); }
    catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
      const transient = status >= 500 || error instanceof TypeError || /failed to fetch|fetch failed|network|temporarily unavailable/i.test(requestError(error,''));
      if (attempt || signal.aborted || !transient || (status >= 400 && status < 500)) throw error;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
