"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle, AlertCircle, ArrowRight, Check } from "lucide-react";
import { type ReactNode } from "react";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export function Button({
  children,
  kind = "primary",
  busy = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${kind} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
const labels: Record<string, string> = {
  draft: "Draft",
  matching: "Finding suppliers",
  negotiating: "Agents negotiating",
  awaiting_approval: "Needs approval",
  ordered: "Order confirmed",
  no_match: "No eligible suppliers",
  declined: "No agreement",
  expired: "Expired",
  cancelled: "Cancelled",
  failed: "Needs attention",
  confirmed_demo: "Confirmed demo order",
};
export function Status({ state }: { state: string }) {
  return (
    <span className={`status status-${state}`}>
      <span className="status-dot" />
      {labels[state] || state.replaceAll("_", " ")}
    </span>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? "modal-wide" : ""}`}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Review the details below."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorBox({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss?: () => void;
}) {
  return error ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
      {onDismiss && (
        <button
          className="icon-button"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  ) : null;
}
export function Loading({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  privateField = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  privateField?: boolean;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>
        {label}
        {privateField && <small className="private-label">Private</small>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.length === 10 ? value + "T12:00:00" : value));
}
export function time(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function shortId(value: string) {
  return value.slice(-8).toUpperCase();
}
export function Tick({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`approval-tick ${done ? "done" : ""}`}>
      {done ? <Check size={14} /> : <span className="tick-circle" />}
      {label}
    </span>
  );
}
export function GoIcon() {
  return <ArrowRight size={16} />;
}
