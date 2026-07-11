"use client";
import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlClasses =
  "w-full rounded-control border border-line-strong bg-surface px-3 text-body text-ink placeholder:text-ink-tertiary focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

type FieldShellProps = {
  label: string;
  help?: string;
  error?: string;
  id: string;
  children: React.ReactNode;
};

function FieldShell({ label, help, error, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-sm text-ink-tertiary">{help}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
  error?: string;
};

/** Labeled input — placeholder-as-label is banned (DESIGN_SYSTEM §1.10). */
export function TextField({ label, help, error, ...rest }: TextFieldProps) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldShell label={label} help={help} error={error} id={id}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${controlClasses} h-9 ${error ? "border-danger" : ""}`}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  help?: string;
  error?: string;
};

export function TextAreaField({ label, help, error, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldShell label={label} help={help} error={error} id={id}>
      <textarea
        id={id}
        rows={rest.rows ?? 3}
        aria-invalid={error ? true : undefined}
        className={`${controlClasses} resize-y py-2 ${error ? "border-danger" : ""}`}
        {...rest}
      />
    </FieldShell>
  );
}
