import {MotionPortal} from "./ui/MotionPortal";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCouples } from "../contexts/CouplesContext";
const SyncHistoryModal = React.lazy(() => import('./SyncHistoryModal').then(module=>({default:module.SyncHistoryModal})));
export function IdentityLockdownPrompt() {
  const { isSyncRequired, identityReady, couple } = useCouples();
  const location = useLocation();
  const needed = couple?.status === "active" && identityReady && isSyncRequired;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (needed) setOpen(true);
  }, [needed]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("recheck-lockdown", show);
    return () => window.removeEventListener("recheck-lockdown", show);
  }, []);
  if (!/\/notes$/.test(location.pathname) || !needed) return null;
  return (
    <>
      {!open && (
        <MotionPortal><button
          onClick={() => setOpen(true)}
          className="on-brand fixed bottom-40 right-4 z-50 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Restore chats
        </button></MotionPortal>
      )}
      {open&&<React.Suspense fallback={null}><SyncHistoryModal isOpen={open} onClose={() => setOpen(false)} /></React.Suspense>}
    </>
  );
}
