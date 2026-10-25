import { supabase } from './supabase';
import { generateKeyPair, encryptWithEphemeralKey, derivePublicKeyFromPrivate } from './encryption';

export interface SyncSession {
    id: string;
    token: string;
    ephemeral_public_key: string;
    encrypted_payload?: string;
    status: 'pending' | 'completed' | 'expired';
}

/**
 * Initiates a sync session on the NEW device
 */
export async function createSyncSession(userId: string): Promise<{ session: any, ephemeralPrivate: string }> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const token = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => alphabet[byte & 31]).join('');
    const { publicKey, privateKey } = await generateKeyPair();

    const { data, error } = await supabase
        .from('sync_sessions' as any)
        .insert({
            user_id: userId,
            token,
            ephemeral_public_key: publicKey,
            status: 'pending'
        } as any)
        .select()
        .single();

    if (error) throw error;
    return { session: data, ephemeralPrivate: privateKey };
}

/**
 * Completes a sync session from the EXISTING device
 */
export async function sendSyncPayload(
    token: string,
    identityPrivateKey: string,
    ownPrivateKey: string
): Promise<void> {
    // 1. Fetch the session
    const { data: session, error: fetchError } = await (supabase
        .from('sync_sessions' as any)
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single() as any);

    if (fetchError || !session) throw new Error('Session not found or expired');

    // 2. Encrypt the identity private key with the new device's ephemeral public key
    const encryptedPayload = await encryptWithEphemeralKey(
        identityPrivateKey,
        session.ephemeral_public_key,
        ownPrivateKey
    );

    // 3. Update the session with the payload
    const { error: updateError } = await (supabase
        .from('sync_sessions' as any)
        .update({
            encrypted_payload: JSON.stringify({ version: 1, senderPublicKey: derivePublicKeyFromPrivate(ownPrivateKey), ciphertext: encryptedPayload }),
            status: 'completed'
        } as any)
        .eq('id', session.id).eq('status','pending').select('id').single() as any);

    if (updateError) throw updateError;
}
