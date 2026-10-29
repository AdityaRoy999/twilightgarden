/** Older iOS WebViews lack AbortSignal.any/timeout. Keep bounded waits and
 * cancellation available without modifying global browser objects. */
export function requestSignal(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason);
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  if (parent?.aborted) cancel(); else parent?.addEventListener('abort', cancel, { once: true });
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); parent?.removeEventListener('abort', cancel); } };
}
