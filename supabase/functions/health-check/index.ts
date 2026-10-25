import { adminClient, corsHeaders, isInternal, json } from '../_shared/security.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!await isInternal(req)) return json({ error: 'Internal authentication required' }, 401);
  const backend = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const services = [
    { service: 'Website', url: 'https://twilight-mocha.vercel.app', authenticated: false },
    { service: 'Supabase Auth', url: backend + '/auth/v1/health', authenticated: true },
    { service: 'Supabase Database', url: backend + '/rest/v1/', authenticated: true },
    { service: 'Supabase Storage', url: backend + '/storage/v1/bucket', authenticated: true },
  ];
  try {
    const checks = await Promise.all(services.map(async ({ service, url, authenticated }) => {
      const start = performance.now();
      try {
        const response = await fetch(url, {
          headers: authenticated ? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        const latency_ms = Math.round(performance.now() - start);
        await response.body?.cancel();
        return { service, status: response.ok ? latency_ms < 2500 ? 'operational' : 'degraded' : 'down', latency_ms, status_code: response.status, error_message: null };
      } catch {
        return { service, status: 'down', latency_ms: Math.round(performance.now() - start), status_code: null, error_message: 'Health probe failed' };
      }
    }));
    const { error } = await adminClient().from('service_checks').insert(checks);
    if (error) throw error;
    return json({ success: true, checks });
  } catch { return json({ error: 'Health check failed' }, 500); }
});
