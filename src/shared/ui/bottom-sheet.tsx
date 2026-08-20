"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export const BottomSheet = ({ triggerLabel, children }: Readonly<{ triggerLabel: string; children: ReactNode }>) => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const restoreTriggerFocus = () => { setOpen(false); queueMicrotask(() => triggerRef.current?.focus()); };
  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else { dialog?.removeAttribute("open"); restoreTriggerFocus(); }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      headingRef.current?.focus();
    }
  }, [open]);

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector));
    if (nodes.length === 0) { event.preventDefault(); headingRef.current?.focus(); return; }
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <><button aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} ref={triggerRef} type="button">{triggerLabel}</button><dialog aria-labelledby={headingId} className="bottomSheet" onCancel={(event) => { event.preventDefault(); close(); }} onClose={restoreTriggerFocus} onKeyDown={trapFocus} ref={dialogRef}><div><div><h2 id={headingId} ref={headingRef} tabIndex={-1}>{triggerLabel}</h2><button aria-label="닫기" onClick={close} type="button">닫기</button></div>{children}</div></dialog></>;
};
