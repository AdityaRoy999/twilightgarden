import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface WellnessContext {
    phase: string;
    cycleDay: number;
    moods: string[];
    symptoms: string[];
    sleepQuality?: string;
    energyLevel?: string;
    partnerName?: string;
    logHistory?: string; // Summarized history of last 15 logs
}

export interface Product {
    title: string;
    link: string;
    image: string;
    price?: string;
    source: 'Amazon' | 'Flipkart' | 'Nykaa' | 'Myntra' | 'Blinkit' | 'Other';
}

export interface NearbyShop {
    id: string;
    name: string;
    lat: number;
    lon: number;
    address: string;
    phoneNumber?: string;
    imageUrl?: string;
    distanceRelevance?: number; // Sorting helper
}

export interface RouteGeometry {
    coordinates: [number, number][]; // [lon, lat] for Leaflet/OSRM
    distance: number; // meters
    duration: number; // seconds
}

interface AIResult {
    text: string;
    error?: string;
}

async function callAI(customPrompt: string, mood: string = 'encouragement'): Promise<AIResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(
            `${SUPABASE_URL}/functions/v1/ai-generate`,
            {
                method: 'POST',
                signal: AbortSignal.timeout(30000),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ mood, customPrompt }),
            }
        );


        if (!res.ok) {
            const errText = await res.text();
            let errMsg = `HTTP ${res.status}`;
            try { const errJson = JSON.parse(errText); errMsg = errJson.error || errMsg; } catch { }
            throw new Error(errMsg);
        }

        const data = await res.json();
        return { text: data.text };
    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return { text: '', error: 'Request timed out. Please try again.' };
        }
        return { text: '', error: error.message || 'Failed to generate' };
    }
}

export async function generateWellnessTips(ctx: WellnessContext): Promise<AIResult> {
    const prompt = `You are a compassionate women's health wellness advisor. Based on the following cycle data and user history, generate 3 highly personalized, concise wellness tips. Each tip MUST start with a real emoji, followed by a bold title, and 1-2 sentences of advice.

Current Phase: ${ctx.phase} (Day ${ctx.cycleDay})
Moods: ${ctx.moods.length > 0 ? ctx.moods.join(', ') : 'Not logged'}
Symptoms: ${ctx.symptoms.length > 0 ? ctx.symptoms.join(', ') : 'None reported'}
Sleep Quality: ${ctx.sleepQuality || 'Not tracked'}
Energy Level: ${ctx.energyLevel || 'Not tracked'}

Recent History (Last 15 logs):
${ctx.logHistory || 'No history available yet.'}

Format each tip as:
[emoji] **[Title]**
[Advice text]

Ensure each tip is fully completed and do not cut off mid-sentence. Focus on actionable, phase-specific advice.`;

    return callAI(prompt, 'raw');
}

export async function generateEmpathyAlerts(ctx: WellnessContext): Promise<AIResult> {
    const prompt = `You are a relationship wellness advisor helping a partner understand and support their significant other. Generate 3 concise empathy alerts. Each alert MUST start with a real emoji, followed by a bold title, and 1-2 sentences of care advice.

Partner's Current Phase: ${ctx.phase} (Day ${ctx.cycleDay})
Their Moods: ${ctx.moods.length > 0 ? ctx.moods.join(', ') : 'Not logged'}
Their Symptoms: ${ctx.symptoms.length > 0 ? ctx.symptoms.join(', ') : 'None reported'}
Their Sleep Quality: ${ctx.sleepQuality || 'Not tracked'}
Their Energy Level: ${ctx.energyLevel || 'Not tracked'}

Partner's Recent History (Last 15 logs):
${ctx.logHistory || 'No history available yet.'}

Format each alert as:
[emoji] **[Title]**
[How to react / what to do]

Ensure the text is fully completed. Be warm, specific, and practical.`;

    return callAI(prompt, 'raw');
}

export async function generateGiftRecommendations(ctx: WellnessContext): Promise<AIResult> {
    const prompt = `You are a professional gift curator in India. Based on the partner's context, generate 5 SPECIFIC search queries to find gifts on Myntra, Nykaa, Flipkart, Amazon, and Blinkit.

Partner's Current Context:
- Phase: ${ctx.phase}
- Today's Moods: ${ctx.moods.join(', ') || 'Not logged'}
- Symptoms: ${ctx.symptoms.join(', ') || 'None reported'}
- Energy/Sleep: ${ctx.energyLevel || 'Normal'} energy, ${ctx.sleepQuality || 'Normal'} sleep.

QUERY FORMAT STRATEGY (Vary the sites!):
1. For Myntra: Generate a fashion query like "Floral cotton dress on Myntra".
2. For Nykaa: Generate a jewelry/beauty query like "Gold plated necklace on Nykaa".
3. For Flipkart: Generate a general/comfort query like "Electric period pain relief pad on Flipkart".
4. For Amazon: Generate a toy/comfort query like "Hug n Feel giant teddy bear on Amazon".
5. For Blinkit: Generate a query for quick-delivery comfort items like "Gourmet dark chocolates on Blinkit" or "Healthy wellness snacks on Blinkit" or "Period cooling patches on Blinkit".

CRITICAL: Return ONLY a comma-separated list of EXACTLY 5 search queries. 
MUST include one query for EVERY platform: Myntra, Nykaa, Flipkart, Amazon, and Blinkit.
DO NOT include any greeting or conversational text.`;

    return callAI(prompt, 'raw');
}

export async function searchShoppingProducts(query: string): Promise<Product[]> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(
            `${SUPABASE_URL}/functions/v1/ai-generate`,
            {
                method: 'POST',
                signal: AbortSignal.timeout(30000),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ 
                    mood: 'search', 
                    search_query: query 
                }),
            }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        return data.products || [];
    } catch (error) {
        console.error('Edge function search error:', error);
        return [];
    }
}

// --- Nearest Pad (Serper Places API) ---

export async function searchNearbyPharmacies(lat: number, lon: number): Promise<NearbyShop[]> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // Query: "pharmacy medical store near lat,lon"
        const query = `pharmacy medical store near ${lat},${lon}`;
        
        const res = await fetch(
            `${SUPABASE_URL}/functions/v1/ai-generate`,
            {
                method: 'POST',
                signal: AbortSignal.timeout(30000),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ 
                    mood: 'places', 
                    search_query: 'pharmacy medical store', // Edge function will use lat/lon for sorting/picking
                    lat: lat,
                    lon: lon
                }),
            }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const places = data.places || [];

        return places.map((el: any) => ({
            id: el.cid || Math.random().toString(),
            name: el.title || 'Pharmacy',
            lat: el.latitude,
            lon: el.longitude,
            address: el.address || '',
            phoneNumber: el.phoneNumber || '',
            imageUrl: el.thumbnailUrl || el.imageUrl || '',
            distanceRelevance: Math.pow(el.latitude - lat, 2) + Math.pow(el.longitude - lon, 2)
        })).sort((a: NearbyShop, b: NearbyShop) => (a.distanceRelevance || 0) - (b.distanceRelevance || 0));

    } catch (error) {
        console.error('Failed to fetch pharmacies from Edge Function:', error);
        return [];
    }
}

export async function getRouteToShop(startLat: number, startLon: number, endLat: number, endLon: number): Promise<RouteGeometry | null> {
    try {
        // OSRM expects coordinates in LON,LAT format
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error('OSRM API failed');
        
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;

        const route = data.routes[0];
        return {
            coordinates: route.geometry.coordinates, // Array of [lon, lat]
            distance: route.distance,
            duration: route.duration
        };
    } catch (error) {
        console.error('Failed to fetch route:', error);
        return null;
    }
}

// Client-side sleep/energy correlation analysis
export function analyzeSleepEnergyCorrelations(logs: any[]) {
    const validLogs = logs.filter(l => l.sleepQuality || l.sleep_quality || l.energyLevel || l.energy_level);

    // Normalize field names (DB uses snake_case, app uses camelCase)
    const normalized = validLogs.map(l => ({
        date: l.date,
        sleep: l.sleepQuality || l.sleep_quality || null,
        energy: l.energyLevel || l.energy_level || null,
        moods: l.moods || [],
        flow: l.flow || null,
    }));

    // Sleep distribution
    const sleepCounts = { good: 0, fair: 0, poor: 0 };
    normalized.forEach(l => {
        if (l.sleep && sleepCounts.hasOwnProperty(l.sleep)) {
            sleepCounts[l.sleep as keyof typeof sleepCounts]++;
        }
    });

    // Energy distribution
    const energyCounts = { high: 0, medium: 0, low: 0 };
    normalized.forEach(l => {
        if (l.energy && energyCounts.hasOwnProperty(l.energy)) {
            energyCounts[l.energy as keyof typeof energyCounts]++;
        }
    });

    // Correlation: sleep quality → energy level
    const sleepEnergyMap: Record<string, Record<string, number>> = {
        good: { high: 0, medium: 0, low: 0 },
        fair: { high: 0, medium: 0, low: 0 },
        poor: { high: 0, medium: 0, low: 0 },
    };

    normalized.forEach(l => {
        if (l.sleep && l.energy && sleepEnergyMap[l.sleep]) {
            sleepEnergyMap[l.sleep][l.energy]++;
        }
    });

    // Generate insights
    const insights: string[] = [];
    const totalWithBoth = normalized.filter(l => l.sleep && l.energy).length;

    if (totalWithBoth >= 3) {
        const goodSleepHighEnergy = sleepEnergyMap.good.high;
        const poorSleepLowEnergy = sleepEnergyMap.poor.low;
        const goodSleepTotal = sleepCounts.good;
        const poorSleepTotal = sleepCounts.poor;

        if (goodSleepTotal > 0) {
            const highEnergyRate = Math.round((goodSleepHighEnergy / goodSleepTotal) * 100);
            if (highEnergyRate > 30) {
                insights.push(`On days with good sleep, you have high energy ${highEnergyRate}% of the time ✨`);
            }
        }

        if (poorSleepTotal > 0) {
            const lowEnergyRate = Math.round((poorSleepLowEnergy / poorSleepTotal) * 100);
            if (lowEnergyRate > 30) {
                insights.push(`Poor sleep correlates with low energy ${lowEnergyRate}% of the time 😴`);
            }
        }

        // Flow impact on sleep
        const flowDays = normalized.filter(l => l.flow && l.sleep);
        const nonFlowDays = normalized.filter(l => !l.flow && l.sleep);
        if (flowDays.length >= 2 && nonFlowDays.length >= 2) {
            const flowPoorRate = flowDays.filter(l => l.sleep === 'poor').length / flowDays.length;
            const nonFlowPoorRate = nonFlowDays.filter(l => l.sleep === 'poor').length / nonFlowDays.length;
            if (flowPoorRate > nonFlowPoorRate * 1.3) {
                insights.push(`Your sleep quality tends to decrease during your period 🌙`);
            }
        }
    }

    if (insights.length === 0) {
        insights.push('Keep logging your sleep and energy to unlock personalized correlations! 📊');
    }

    return {
        sleepCounts,
        energyCounts,
        sleepEnergyMap,
        insights,
        totalLogs: normalized.length,
        totalWithBoth,
    };
}
