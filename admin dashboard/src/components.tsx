import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MotionPortal } from "../../components/ui/MotionPortal";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { springs } from "../../lib/motion";
import type { Run } from "../shared/types";
import { icon } from "./format";
export function Status({ run }: { run: Run }) {
  const state = run.conclusion || run.status;
  return (
    <span className={`status ${state}`}>
      <i />
      {state.replaceAll("_", " ")}
    </span>
  );
}
export function Modal({
  title,
  children,
  close,
  reduced,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  reduced: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [close]);
  return (
    <MotionPortal>
      <div className="modal-scrim" onClick={close}>
        <motion.div
          ref={ref}
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          initial={reduced ? false : { opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduced ? { duration: 0 } : springs.modal}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-heading">
            <h2>{title}</h2>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={close}
            >
              {icon("X")}
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    </MotionPortal>
  );
}
