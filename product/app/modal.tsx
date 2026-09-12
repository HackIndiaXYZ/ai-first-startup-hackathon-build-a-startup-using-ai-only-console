"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  label,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  label?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const id = useId(),
    ref = useRef<HTMLElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    (
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ||
      close.current
    )?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={() => !busy && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Tab") {
          const f = ref.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
          );
          if (!f?.length) return;
          const first = f[0],
            last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <section
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            {label && <div className="eyebrow">{label}</div>}
            <h2 id={id}>{title}</h2>
          </div>
          <button
            ref={close}
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
