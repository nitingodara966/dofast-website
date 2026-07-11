"use client";
import { useEffect, useId, useRef } from "react";

/*
 * Dialog + Drawer — hand-rolled per M7.5 ruling 3, against the DESIGN_SYSTEM
 * §1.10 contract: focus trap, Tab/Shift+Tab cycling, Escape-to-close, focus
 * restoration to the invoker, outside-click close, ARIA roles and naming.
 * Contract is test-enforced in components/ui/ui.test.tsx.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useOverlayBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  return panelRef;
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: "dialog" | "drawer";
};

export function Overlay({
  open,
  onClose,
  title,
  children,
  variant = "dialog",
}: OverlayProps) {
  const panelRef = useOverlayBehavior(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        variant === "dialog" ? "items-center justify-center p-6" : "justify-end"
      }`}
    >
      <div
        aria-hidden
        data-testid="overlay-backdrop"
        onMouseDown={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-surface shadow-overlay ${
          variant === "dialog"
            ? "w-full max-w-md rounded-card p-6"
            : "h-full w-full max-w-lg overflow-y-auto p-6"
        }`}
      >
        <h2 id={titleId} className="font-serif text-xl font-medium mb-4">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Dialog(props: Omit<OverlayProps, "variant">) {
  return <Overlay {...props} variant="dialog" />;
}

export function Drawer(props: Omit<OverlayProps, "variant">) {
  return <Overlay {...props} variant="drawer" />;
}
