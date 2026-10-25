import { supabase } from './supabase';

export async function endSession(sessionId: string) {
    if (!sessionId) return;
    try {
        const { error } = await supabase.from('game_sessions')
            .update({ status: 'ended' })
            .eq('id', sessionId);
        if (error) throw error;
    } catch (err) {
        console.error('[gameSessions] endSession error', err);
        throw err;
    }
}

export default { endSession };
