// Public business contacts only. Never put private addresses or credentials here.
export const legalConfig={
 operator:import.meta.env.VITE_LEGAL_OPERATOR_NAME||'',
 address:import.meta.env.VITE_LEGAL_SERVICE_ADDRESS||'',
 support:import.meta.env.VITE_LEGAL_SUPPORT_EMAIL||'',
 grievanceName:import.meta.env.VITE_GRIEVANCE_OFFICER_NAME||'',
 grievanceEmail:import.meta.env.VITE_GRIEVANCE_OFFICER_EMAIL||'',
};
export const launchContactsReady=Object.values(legalConfig).every(Boolean);
