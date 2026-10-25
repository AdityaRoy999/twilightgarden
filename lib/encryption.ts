import { Preferences } from '@capacitor/preferences';

/**
 * End-to-End Encryption (E2EE) Utility
 * Uses Web Crypto API (ECDH P-256 for key exchange, AES-GCM for encryption)
 *
 * Architecture: Simple, reliable ECDH + AES-GCM
 * - Each user has one stable ECDH key pair (P-256)
 * - Private key stored locally via Capacitor Preferences
 * - Public key uploaded to Supabase (user_keys)
 * - Messages encrypted with a shared secret derived from ECDH
 * - Identity can be backed up/restored via PIN
 */

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generates a new P-256 key pair for the user
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256',
        },
        true,
        ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return {
        publicKey: window.btoa(JSON.stringify(publicKeyJwk)),
        privateKey: window.btoa(JSON.stringify(privateKeyJwk))
    };
}

/**
 * Initializes keys locally for a specific user and returns the public key for server upload
 */
let cachedPrivateKey: string | null = null;
let sharedKeyCache = new Map<string, CryptoKey>();
let identityRevision = 0;
const keyInitializations = new Map<string, Promise<string>>();

export async function initializeEncryptionKeys(userId: string): Promise<string> {
    const existing = keyInitializations.get(userId);
    if (existing) return existing;
    const pending = initializeIdentity(userId, identityRevision);
    keyInitializations.set(userId, pending);
    try { return await pending; }
    finally { if (keyInitializations.get(userId) === pending) keyInitializations.delete(userId); }
}

async function initializeIdentity(userId: string, revision: number): Promise<string> {
    const pubKeyName = `${userId}_public_key`;
    const privKeyName = `${userId}_private_key`;

    const { value: existingPubKey } = await Preferences.get({ key: pubKeyName });
    const { value: existingPrivKey } = await Preferences.get({ key: privKeyName });
    if (revision !== identityRevision) throw new Error('Identity initialization was cancelled.');

    if (existingPubKey && existingPrivKey) {
        console.log(`[E2EE] Keys already exist locally for user: ${userId}`);
        setCachedPrivateKey(existingPrivKey);
        return existingPubKey;
    }

    console.log(`[E2EE] Generating new key pair for user: ${userId}...`);
    const { publicKey, privateKey } = await generateKeyPair();

    await Preferences.set({ key: pubKeyName, value: publicKey });
    await Preferences.set({ key: privKeyName, value: privateKey });
    if (revision !== identityRevision) throw new Error('Identity initialization was cancelled.');

    setCachedPrivateKey(privateKey);
    return publicKey;
}

export function clearEncryptionCache() {
    identityRevision++;
    keyInitializations.clear();
    cachedPrivateKey = null;
    sharedKeyCache.clear();
}

/** Clear only the shared-key derivation cache (call after identity restore) */
export function clearSharedKeyCache() {
    sharedKeyCache.clear();
}

export function setCachedPrivateKey(key: string) {
    if (cachedPrivateKey !== key) sharedKeyCache.clear();
    cachedPrivateKey = key;
}

export function getCachedPrivateKey(): string | null {
    return cachedPrivateKey;
}

/**
 * Heuristic: returns true if the string looks like plain-text (decrypted) content,
 * false if it looks like a raw Base64 ciphertext or the lock placeholder.
 */
export function isContentDecrypted(content: string | null | undefined): boolean {
    if (!content) return true; // empty/null counts as "decrypted"
    if (content.startsWith('🔐')) return true; // placeholder is still "processed"
    // Base64 cipher: long, no spaces, only B64 chars
    if (content.length > 40 && !/\s/.test(content) && /^[A-Za-z0-9+/=]+$/.test(content)) {
        return false;
    }
    return true;
}

/**
 * Derives the public key from a private key (both stored as base64-encoded JWK).
 * ECDH private key JWKs contain the public components (x, y), so we just strip the "d" param.
 */
export function derivePublicKeyFromPrivate(privateKeyB64: string): string {
    const privJwk = JSON.parse(window.atob(privateKeyB64));
    const pubJwk = {
        kty: privJwk.kty,
        crv: privJwk.crv,
        x: privJwk.x,
        y: privJwk.y,
    };
    return window.btoa(JSON.stringify(pubJwk));
}

/**
 * Derives a shared secret between the current user and their partner
 */
async function deriveSharedSecret(ownPrivateKeyB64: string, partnerPublicKeyB64: string): Promise<CryptoKey> {
    // JWK suffixes contain common metadata, not a unique key identifier.
    const keyMaterial = new TextEncoder().encode(JSON.stringify([ownPrivateKeyB64, partnerPublicKeyB64]));
    const cacheKey = arrayBufferToBase64(await window.crypto.subtle.digest('SHA-256', keyMaterial));
    const cached = sharedKeyCache.get(cacheKey);
    if (cached) return cached;

    const privateKeyJwk = JSON.parse(window.atob(ownPrivateKeyB64));
    const partnerPublicKeyJwk = JSON.parse(window.atob(partnerPublicKeyB64));

    const ownPrivateKey = await window.crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
    );

    const partnerPublicKey = await window.crypto.subtle.importKey(
        'jwk',
        partnerPublicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );

    const sharedKey = await window.crypto.subtle.deriveKey(
        {
            name: 'ECDH',
            public: partnerPublicKey,
        },
        ownPrivateKey,
        {
            name: 'AES-GCM',
            length: 256,
        },
        false,
        ['encrypt', 'decrypt']
    );

    sharedKeyCache.set(cacheKey, sharedKey);
    return sharedKey;
}

/**
 * Encrypts a message using a shared secret
 */
export async function encryptMessage(text: string, partnerPublicKeyB64: string): Promise<string> {
    const ownPrivateKeyB64 = cachedPrivateKey;
    if (!ownPrivateKeyB64) {
        throw new Error('Private key missing. Call initializeEncryptionKeys first.');
    }

    const sharedKey = await deriveSharedSecret(ownPrivateKeyB64, partnerPublicKeyB64);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        sharedKey,
        encoded
    );

    // Combine IV (12 bytes) + Ciphertext for storage
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypts a message using a shared secret
 */
export async function decryptMessage(encryptedB64: string, partnerPublicKeyB64: string, userId?: string): Promise<string> {
    try {
        // Optimization: Use cached private key if available
        if (!cachedPrivateKey) {
            if (userId) {
                const privKeyName = `${userId}_private_key`;
                const { value } = await Preferences.get({ key: privKeyName });
                cachedPrivateKey = value;

            }
        }

        const ownPrivateKeyB64 = cachedPrivateKey;
        if (!ownPrivateKeyB64) throw new Error('Private key missing');

        const sharedKey = await deriveSharedSecret(ownPrivateKeyB64, partnerPublicKeyB64);

        const combined = new Uint8Array(base64ToArrayBuffer(encryptedB64));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            sharedKey,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.warn('[E2EE] Decryption failed, likely a legacy message or key mismatch');
        // If it looks like a long Base64 string, it's a failed decryption, not plain text
        const noSpaces = !/\s/.test(encryptedB64);
        const onlyBase64Chars = /^[A-Za-z0-9+/=]+$/.test(encryptedB64);
        if (encryptedB64.length > 30 && noSpaces && onlyBase64Chars) {
            return "🔐 Message locked (Key changed — restore identity via PIN)";
        }
        return encryptedB64;
    }
}

/**
 * Encrypts any JSON-serializable data
 */
export async function encryptData(data: any, partnerPublicKeyB64: string): Promise<string> {
    const json = JSON.stringify(data);
    return await encryptMessage(json, partnerPublicKeyB64);
}

/**
 * Decrypts and parses JSON-encoded data
 */
export async function decryptData<T>(encryptedB64: string, partnerPublicKeyB64: string, userId?: string): Promise<T | null> {
    try {
        const decrypted = await decryptMessage(encryptedB64, partnerPublicKeyB64, userId);
        // If decryption failed, decryptMessage returns either the original ciphertext OR a fallback string starting with 🔐
        if (decrypted === encryptedB64 || decrypted.startsWith("🔐")) return null;
        return JSON.parse(decrypted) as T;
    } catch (e) {
        console.warn('[E2EE] Data decryption/parse failed:', e);
        return null;
    }
}

/**
 * Encrypts a binary blob (ArrayBuffer)
 */
export async function encryptBlob(data: ArrayBuffer, partnerPublicKeyB64: string): Promise<ArrayBuffer> {
    const ownPrivateKeyB64 = cachedPrivateKey;
    if (!ownPrivateKeyB64) {
        throw new Error('Private key missing. Call initializeEncryptionKeys first.');
    }

    const sharedKey = await deriveSharedSecret(ownPrivateKeyB64, partnerPublicKeyB64);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        sharedKey,
        data
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return combined.buffer;
}

/**
 * Decrypts a binary blob (ArrayBuffer)
 */
export async function decryptBlob(encryptedData: ArrayBuffer, partnerPublicKeyB64: string): Promise<ArrayBuffer> {
    const ownPrivateKeyB64 = cachedPrivateKey;
    if (!ownPrivateKeyB64) {
        throw new Error('Private key missing. Call initializeEncryptionKeys first.');
    }

    const sharedKey = await deriveSharedSecret(ownPrivateKeyB64, partnerPublicKeyB64);

    const combined = new Uint8Array(encryptedData);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    return await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        sharedKey,
        ciphertext
    );
}

/**
 * Generates a 60-digit fingerprint for manual verification (WhatsApp style)
 */
export async function generateVerificationFingerprint(ownPubKey: string, partnerPubKey: string): Promise<string> {
    const sortedKeys = [ownPubKey, partnerPubKey].sort();
    const combined = sortedKeys.join('');
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert hash bytes to a 60-digit numeric string (12 groups of 5 digits)
    let digits = "";
    for (let i = 0; i < 24; i += 2) {
        const val = ((hashArray[i] << 8) | hashArray[i + 1]) % 100000;
        digits += val.toString().padStart(5, '0');
    }
    return digits;
}

/**
 * History Sync: PIN-based identity encryption
 * Used to back up the private key to the cloud, encrypted with a user-chosen PIN.
 */

async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);

    const baseKey = await window.crypto.subtle.importKey(
        'raw', pinData, 'PBKDF2', false, ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer as ArrayBuffer,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptIdentityWithPin(privateKeyB64: string, pin: string): Promise<{ ciphertext: string, salt: string }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const sharedKey = await derivePinKey(pin, salt);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(privateKeyB64);

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return {
        ciphertext: arrayBufferToBase64(combined.buffer),
        salt: arrayBufferToBase64(salt.buffer)
    };
}

export async function decryptIdentityWithPin(encryptedB64: string, pin: string, saltB64: string): Promise<string> {
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const sharedKey = await derivePinKey(pin, salt);

    const combined = new Uint8Array(base64ToArrayBuffer(encryptedB64));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        sharedKey,
        ciphertext.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decrypted);
}

/**
 * History Sync: Ephemeral Key Handshake (QR Sync)
 * Used to transfer the private key from a trusted device to a new device.
 */

export async function encryptWithEphemeralKey(payload: string, ephemeralPublicKeyB64: string, ownPrivateKeyB64: string): Promise<string> {
    const sharedKey = await deriveSharedSecret(ownPrivateKeyB64, ephemeralPublicKeyB64);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(payload);

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayBufferToBase64(combined.buffer);
}

export async function decryptWithEphemeralKey(encryptedB64: string, originalEphemeralPrivateKeyB64: string, senderPublicKeyB64: string): Promise<string> {
    const sharedKey = await deriveSharedSecret(originalEphemeralPrivateKeyB64, senderPublicKeyB64);

    const combined = new Uint8Array(base64ToArrayBuffer(encryptedB64));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv.buffer as ArrayBuffer,
        },
        sharedKey,
        ciphertext.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decrypted);
}
