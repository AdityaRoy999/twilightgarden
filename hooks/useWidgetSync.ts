import {useEffect} from 'react';
import {Preferences} from '@capacitor/preferences';
/** Retire old plaintext widget snapshots. A native widget must perform its own
 * protected-key decryption before private health/chat content can be enabled. */
export function useWidgetSync(){useEffect(()=>{void Preferences.remove({key:'twilight_widget_payload'});},[]);}
