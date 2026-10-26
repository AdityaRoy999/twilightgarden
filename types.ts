export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'user' | 'admin' | 'partner';
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    is_partner?: boolean;
    [key: string]: any;
  };
}

export type FlowIntensity = "spotting" | "light" | "medium" | "heavy";
export type Mood =
  | "calm"
  | "happy"
  | "energetic"
  | "frisky"
  | "swings"
  | "anxious"
  | "sad"
  | "irritated";
export type SymptomCategory = "physical" | "digestion" | "other";

export interface DailyLog {
  periodStarted?: boolean;
  id: string;
  user_id: string;
  date: string; // ISO date string YYYY-MM-DD
  flow?: FlowIntensity;
  moods?: Mood[];
  symptoms?: string[]; // Array of symptom IDs
  notes?: string;
  energyLevel?: "high" | "medium" | "low";
  sleepQuality?: "good" | "fair" | "poor";
  sleepHours?: number;
}

export type DailyLogInput = Omit<DailyLog, 'id' | 'user_id'>;

export interface CycleSettings {
  avgCycleLength: number;
  avgPeriodLength: number;
  lastPeriodStart: string; // ISO date
  onboardingCompleted: boolean;
  irregularCycle: boolean;
}

export interface CyclePhase {
  hasEstimate?: boolean;
  overdueDays?: number;
  currentDay: number;
  phase: "Menstrual" | "Follicular" | "Ovulation" | "Luteal" | "Unknown";
  nextPeriodIn: number;
  isFertile: boolean;
  isOvulation: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  timestamp: string;
}

// Supabase Database Types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Couple {
  id: string;
  partner_1_id: string;
  partner_2_id: string | null;
  pairing_code: string;
  status: 'pending' | 'active';
  partner_1_role: 'menstruator' | 'supporter';
  share_enabled: boolean;
  love_code?: string;
  love_unlocked: boolean;
  created_at: string;
}

export interface SharedNote {
  localStatus?: 'sending' | 'failed';
  sender_public_key?: string | null;
  recipient_public_key?: string | null;
  /** Client-only ciphertext marker used to invalidate the decryption cache. */
  _encryptedContent?: string;
  id: string;
  couple_id: string;
  sender_id: string;
  sender_device_id?: string;
  content: string;
  reply_content: string | null;
  reply_to_id: string | null;
  reactions: { user_id: string; emoji: string }[] | null;
  starred_by: string[] | null;
  pinned_by: string[] | null;
  is_forwarded: boolean;
  deleted_by: string[] | null;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio' | 'gif';
  media_url?: string;
  v?: number;
  created_at: string;
}

export type { Database } from "./lib/database.types";
