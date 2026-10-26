import L from 'leaflet';

// Authored local drawings; no remote marker images or marker shadow bitmaps.
export const pharmacyIcon = L.divIcon({ className: 'twilight-map-pin', iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -30], html: '<svg viewBox="0 0 28 38" aria-hidden="true"><path d="M14 37C10 30 1 22 1 14a13 13 0 0 1 26 0c0 8-9 16-13 23Z" fill="#df4b83"/><circle cx="14" cy="14" r="8" fill="#fff5fa"/><path d="M14 9v10m-5-5h10" stroke="#bd285f" stroke-width="2.5" stroke-linecap="round"/></svg>' });
export const userIcon = L.divIcon({ className: 'twilight-map-pin', iconSize: [28, 28], iconAnchor: [14, 14], html: '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#ceeee5"/><circle cx="14" cy="14" r="8" fill="#289d88" stroke="white" stroke-width="3"/></svg>' });
