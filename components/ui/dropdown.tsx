"use client";
import { useEffect, useId, useRef, useState } from "react";

export type DropdownItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

/*
 * Menu — hand-rolled per M7.5 ruling 3. Contract: arrow-key navigation
 * (Down/Up/Home/End), Escape closes and restores trigger focus, outside click
 * closes, Enter/Space activates, correct ARIA menu semantics. Test-enforced.
 */
export function DropdownMenu({
  trigger,
  items,
}: {
  trigger: React.ReactNode;
  items: DropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setActiveIndex(0);
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setActiveIndex(0);
            setOpen(true);
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-base text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
      >
        {trigger}
        <span aria-hidden className="text-xs">▾</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-1 min-w-44 rounded-control border border-line bg-surface p-1 shadow-overlay"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={`block w-full rounded-control px-3 py-1.5 text-left text-base transition-colors hover:bg-sunken ${
                item.destructive ? "text-danger" : "text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
