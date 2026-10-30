import {useEffect} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {registerPushNotifications} from '../lib/notifications';
/** Mounted only after PrivacyBoundary admits the account. */
export function ConsentedPushRegistration(){const {user}=useAuth();useEffect(()=>{if(user)void registerPushNotifications(user.id).catch(()=>{});},[user?.id]);return null;}
