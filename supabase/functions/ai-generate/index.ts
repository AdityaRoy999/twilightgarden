import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { consumeBudget, json, readBody, requireUser, RequestBodyError } from '../_shared/security.ts';

const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY');
const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY') || Deno.env.get('VITE_SERPER_API');
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3.5-lightning-30b-a3b';
class ProviderError extends Error {
    constructor(public providerStatus: number) { super('Generation provider rejected the request'); }
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Product {
    title: string;
    link: string;
    image: string;
    price?: string;
    source: string;
}

function detectSource(link: string): string {
    const l = link.toLowerCase();
    if (l.includes('amazon')) return 'Amazon';
    if (l.includes('flipkart')) return 'Flipkart';
    if (l.includes('nykaa')) return 'Nykaa';
    if (l.includes('myntra')) return 'Myntra';
    if (l.includes('blinkit')) return 'Blinkit';
    if (l.includes('bigbasket')) return 'Blinkit';
    if (l.includes('swiggy')) return 'Blinkit';
    return 'Other';
}

async function searchProducts(query: string): Promise<Product[]> {
    if (!SERPER_API_KEY) return [];

    try {
        // Try shopping search first
        const shoppingRes = await fetch('https://google.serper.dev/shopping', {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num: 5 }),
        });

        if (shoppingRes.ok) {
            const data = await shoppingRes.json();
            const items = data.shopping || [];
            if (items.length > 0) {
                return items.map((item: any) => ({
                    title: item.title || '',
                    link: item.link || '',
                    image: item.imageUrl || item.thumbnail || '',
                    price: item.price || '',
                    source: detectSource(item.link || item.source || ''),
                }));
            }
        }

        // Fallback: regular search (works better for Blinkit/quick-commerce)
        const searchRes = await fetch('https://google.serper.dev/search', {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query + ' buy India', gl: 'in', hl: 'en', num: 5 }),
        });

        if (searchRes.ok) {
            const data = await searchRes.json();
            const organic = data.organic || [];
            return organic
                .filter((r: any) => r.link && (
                    r.link.includes('amazon') || r.link.includes('flipkart') ||
                    r.link.includes('myntra') || r.link.includes('nykaa') ||
                    r.link.includes('blinkit') || r.link.includes('bigbasket') ||
                    r.link.includes('swiggy')
                ))
                .slice(0, 5)
                .map((r: any) => ({
                    title: r.title || '',
                    link: r.link || '',
                    image: r.thumbnail || r.imageUrl || '',
                    price: '',
                    source: detectSource(r.link || ''),
                }));
        }

        return [];
    } catch (err) {
        console.error('Search failed:', err);
        return [];
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const userId = await requireUser(req);
    if (!userId) return json({ error: 'Authentication required' }, 401);

    try {
        if (!await consumeBudget(userId, 'ai', 10)) return json({ error: 'Please wait before making another request.' }, 429);
        const { mood, customPrompt, search_query, lat, lon } = await readBody(req);
        const supportedModes = ['search','places','raw','missing','morning','appreciation','flirty','apology','encouragement'];
        if (typeof mood !== 'string' || !supportedModes.includes(mood) ||
            (customPrompt !== undefined && (typeof customPrompt !== 'string' || customPrompt.length > 12000)) ||
            (search_query !== undefined && (typeof search_query !== 'string' || search_query.length > 300))) {
            return json({ error: 'Invalid request parameters' }, 400);
        }

        // ── Product Search Mode ──
        if (mood === 'search' && search_query) {
            const products = await searchProducts(search_query);
            return new Response(JSON.stringify({ products }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ── Places Search Mode ──
        if (mood === 'places') {
            if (!SERPER_API_KEY) throw new Error('SERPER_API_KEY is not set');

            if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) ||
                Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: 'Valid coordinates are required' }, 400);

            const placesBody: any = {
                q: search_query || 'pharmacy medical store',
                gl: 'in',
                hl: 'en',
                num: 20 // Increase to fetch more results to find the closest ones
            };

            // Use Serper's ll parameter with a precise zoom level.
            // 14z is roughly city/neighborhood level, which works best for finding local places
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                // By combining "near me" with the ll parameter, Serper correctly geolocates
                placesBody.q = (search_query || 'pharmacy medical store') + ' near me';
                placesBody.ll = `@${lat},${lon},14z`;
            }

            const placesRes = await fetch('https://google.serper.dev/places', {
                method: "POST",
            signal: AbortSignal.timeout(20000),
                headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify(placesBody),
            });

            if (!placesRes.ok) {
                const errText = await placesRes.text();
                throw new Error(`Serper Places error ${placesRes.status}: ${errText}`);
            }

            const data = await placesRes.json();
            return new Response(JSON.stringify({ places: data.places || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ── AI Text Generation Mode ──
        if (!NVIDIA_API_KEY) {
            return json({ error: 'AI generation is not configured.', code: 'AI_NOT_CONFIGURED' }, 503);
        }

        const prompts: Record<string, string> = {
          missing: 'Write a short affectionate message telling my partner I miss them.',
          morning: 'Write a warm, short good-morning message to my partner.',
          appreciation: 'Write a short sincere note appreciating my partner.',
          flirty: 'Write a playful, affectionate, non-explicit message to my partner.',
          apology: 'Write a short sincere apology to my partner without making excuses.',
          encouragement: 'Write a short supportive message encouraging my partner.',
        };
        const prompt = customPrompt || search_query || prompts[mood] || '';
        if (!prompt.trim()) return json({ error: 'A prompt is required' }, 400);

        const response = await fetch(NVIDIA_URL, {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            },
            body: JSON.stringify({
                model: NVIDIA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 0.9,
                stream: false,
            }),
        });

        if (!response.ok) {
            await response.body?.cancel();
            throw new ProviderError(response.status);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('Empty generation response');

        return new Response(JSON.stringify({ text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
        if (error instanceof ProviderError) {
            console.error('Generation provider rejected request', { model: NVIDIA_MODEL, status: error.providerStatus });
            return json({ error: 'AI generation is temporarily unavailable.', code: 'AI_UPSTREAM_REJECTED', providerStatus: error.providerStatus }, 502);
        }
        console.error('AI request failed', error instanceof Error ? error.name : 'UnknownError');
        return json({ error: error instanceof SyntaxError ? 'Invalid JSON body' : 'The request could not be completed. Please retry.' }, error instanceof SyntaxError ? 400 : 502);
    }
});
