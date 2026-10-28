import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCouples } from "../contexts/CouplesContext";
const SyncHistoryModal = React.lazy(() => import('./SyncHistoryModal').then(module=>({default:module.SyncHistoryModal})));
export function IdentityLockdownPrompt() {
  const { isSyncRequired, identityReady, couple, hasCloudBackup } = useCouples();
  const location = useLocation();
  const active = couple?.status === "active" && identityReady;
  const needed = active && (isSyncRequired || !hasCloudBackup);
  const prompt = needed ? `${couple.id}:${isSyncRequired ? 'recover' : 'setup'}` : null;
  const prompted = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) { prompted.current = null; setOpen(false); }
    else if (prompt && prompt !== prompted.current) {
      prompted.current = prompt;
      setOpen(true);
    }
  }, [active, prompt]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("recheck-lockdown", show);
    return () => window.removeEventListener("recheck-lockdown", show);
  }, []);
  if (!/\/notes$/.test(location.pathname) || !active) return null;
  return (
    <>
      {open&&<React.Suspense fallback={null}><SyncHistoryModal isOpen={open} onClose={() => setOpen(false)} /></React.Suspense>}
    </>
  );
}
