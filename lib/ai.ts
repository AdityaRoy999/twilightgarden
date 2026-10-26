import { supabase } from './supabase';

export type AIMood = 'missing' | 'morning' | 'appreciation' | 'flirty' | 'apology' | 'encouragement';

export interface AIGenerateResult {
    text: string;
    error?: string;
}

export const AI_MOODS: { key: AIMood; label: string; emoji: string }[] = [
    { key: 'missing', label: 'Missing You', emoji: '🥺' },
    { key: 'morning', label: 'Good Morning', emoji: '🌅' },
    { key: 'appreciation', label: 'Appreciation', emoji: '💝' },
    { key: 'flirty', label: 'Flirty', emoji: '😏' },
    { key: 'apology', label: 'Apology', emoji: '🥹' },
    { key: 'encouragement', label: 'You Got This', emoji: '💪' },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export async function generateLoveNote(mood: AIMood, customPrompt?: string): Promise<AIGenerateResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        console.log('[AI] Calling ai-generate with mood:', mood);

        // Add a 30s timeout
        const signal = AbortSignal.timeout(30000);

        const res = await fetch(
            `${SUPABASE_URL}/functions/v1/ai-generate`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ mood, customPrompt }),
                signal,
            }
        );


        console.log('[AI] Response status:', res.status);

        if (!res.ok) {
            const errText = await res.text();
            console.error('[AI] Error response:', errText);
            let errMsg = `HTTP ${res.status}`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.error || errMsg;
            } catch {}
            throw new Error(errMsg);
        }

        const data = await res.json();
        console.log('[AI] Generated text:', data.text?.substring(0, 50) + '...');
        return { text: data.text };
    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            console.error('[AI] Request timed out after 30s');
            return { text: '', error: 'Request timed out. Please try again.' };
        }
        console.error('[AI] Generation error:', error);
        return { text: '', error: error.message || 'Failed to generate message' };
    }
}
