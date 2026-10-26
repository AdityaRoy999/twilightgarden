import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCouples } from "../contexts/CouplesContext";
import { SyncHistoryModal } from "./SyncHistoryModal";
export function IdentityLockdownPrompt() {
  const { isSyncRequired, identityReady } = useCouples();
  const location = useLocation();
  const needed = identityReady && isSyncRequired;
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
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-40 right-4 z-50 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Restore chats
        </button>
      )}
      <SyncHistoryModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
