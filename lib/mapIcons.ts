import L from 'leaflet';
import solar from '../components/ui/solar-data.json';

// Trusted local Solar geometry, with no remote marker images or shadow bitmaps.
const marker = (body: string, color: string) => `<svg class="solar-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" style="color:${color}" aria-hidden="true">${body}</svg>`;
export const pharmacyIcon = L.divIcon({ className: 'twilight-map-pin', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -24], html: marker(solar.Location.body, 'var(--color-primary-ink)') });
export const userIcon = L.divIcon({ className: 'twilight-map-pin', iconSize: [28, 28], iconAnchor: [14, 14], html: marker(solar.UserRound.body, '#289d88') });
