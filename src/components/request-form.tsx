"use client";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  Package,
  CheckCircle2,
} from "lucide-react";
import type { RequestInput, PurchaseRequest } from "@/lib/types";
import { api, Button, ErrorBox, Field, Modal } from "./ui";
const example =
  "Buy 80 stackable polypropylene chairs, delivered to Sofia within 14 days, maximum €7,000 including delivery. Prefer a lower deposit.";
type FormFields = Omit<RequestInput, "quantity" | "maxBudget"> & {
  quantity: number | string;
  maxBudget: number | string;
};
function initial(value?: PurchaseRequest): FormFields {
  return value
    ? {
        title: value.title,
        description: value.description,
        buyerType: "business",
        quantity: value.quantity,
        material: value.material,
        stackable: value.stackable,
        destination: value.destination,
        latestDelivery: value.latestDelivery,
        maxBudget: value.maxBudget / 100,
        maxDeposit: value.maxDeposit,
        preference: value.preference,
      }
    : {
        title: "",
        description: "",
        buyerType: "business",
        quantity: "",
        material: "any",
        stackable: false,
        destination: "",
        latestDelivery: "",
        maxBudget: "",
        maxDeposit: 100,
        preference: "lower_deposit",
      };
}
export default function RequestForm({
  draft,
  onClose,
  onSaved,
}: {
  draft?: PurchaseRequest;
  onClose: () => void;
  onSaved: (request: PurchaseRequest, launch: boolean) => Promise<void>;
}) {
  const [step, setStep] = useState(draft ? 2 : 1);
  const [text, setText] = useState("");
  const [form, setForm] = useState<FormFields>(initial(draft));
  const [notes, setNotes] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);
  const unsupported =
    notes.some((n) => /outside|cannot validate/i.test(n)) ||
    /\b(?:armrests|ergonomic|warranty|certified|recycled|fireproof|leather|adjustable|steel|metal|upholstered|black|white|grey|gray|blue|red|green|beige|color|colour|desks|tables)\b/i.test(
      form.description,
    );
  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function extract() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{
        fields: Partial<RequestInput>;
        notes: string[];
        missing: string[];
      }>("/api/extract", "POST", { text });
      setForm((f) => ({
        ...f,
        ...r.fields,
        description: text,
        ...(r.fields.maxBudget !== undefined
          ? { maxBudget: r.fields.maxBudget / 100 }
          : {}),
      }));
      setMissing(r.missing);
      setNotes(r.notes);
      setResolved(false);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const launch =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "launch";
    if (launch && unsupported && !resolved) {
      setError(
        "Resolve the unsupported requirements and confirm the structured fields before launching.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: RequestInput = {
        ...form,
        quantity: Number(form.quantity),
        maxBudget: Math.round(Number(form.maxBudget) * 100),
      };
      const r = await api<PurchaseRequest>(
        draft ? `/api/requests/${draft.id}` : "/api/requests",
        draft ? "PATCH" : "POST",
        payload,
      );
      await onSaved(r, launch);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={draft ? "Review purchase request" : "Create a purchase request"}
      description="Tell your buying agent what you need. You stay in control of the deal."
      wide
    >
      <div className="form-steps">
        <span className={step === 1 ? "active" : ""}>
          1 <b>Describe your need</b>
        </span>
        <ArrowRight size={16} />
        <span className={step === 2 ? "active" : ""}>
          2 <b>Review requirements</b>
        </span>
      </div>
      <ErrorBox error={error} />
      {step === 1 ? (
        <div className="form-body">
          <div className="form-intro-icon">
            <Sparkles size={23} />
          </div>
          <h3>What would you like to source?</h3>
          <p className="muted">
            Include quantity, specifications, destination, deadline, and your
            total budget.
          </p>
          <label className="sr-only" htmlFor="request-text">
            Describe your purchase
          </label>
          <textarea
            id="request-text"
            className="request-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="We need 80 stackable chairs for our new office in Sofia…"
            maxLength={3000}
          />
          <button className="sample-button" onClick={() => setText(example)}>
            <Package size={16} />
            <span>Try the 80-chair example</span>
            <ArrowRight size={15} />
          </button>
          <div className="info-note">
            <LockKeyhole size={16} />
            <p>
              Your budget and deposit limit are private to your buying agent.
            </p>
          </div>
          <div className="modal-footer">
            <Button kind="ghost" onClick={() => setStep(2)}>
              Enter fields manually
            </Button>
            <Button
              onClick={extract}
              disabled={text.trim().length < 10}
              busy={busy}
            >
              Extract requirements
              <Sparkles size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-body review-form">
            {(notes.length > 0 || missing.length > 0) && (
              <div className="notice">
                <CheckCircle2 size={18} />
                <div>
                  <b>Review before your agents begin</b>
                  {missing.length > 0 && (
                    <p>
                      Check these required details:{" "}
                      {missing
                        .map(
                          (k) =>
                            (
                              ({
                                maxDeposit: "maximum deposit",
                                maxBudget: "total budget",
                                latestDelivery: "delivery deadline",
                                stackable: "stacking requirement",
                                preference: "offer preference",
                              }) as Record<string, string>
                            )[k] || k,
                        )
                        .join(", ")}
                      .
                    </p>
                  )}
                  {notes.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="form-grid">
              <Field label="Request title" className="span-2">
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="80 stackable chairs"
                />
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  required
                  min={1}
                  max={10000}
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                />
              </Field>
              <Field label="Material">
                <select
                  value={form.material}
                  onChange={(e) =>
                    set("material", e.target.value as RequestInput["material"])
                  }
                >
                  <option value="any">Any material</option>
                  <option value="polypropylene">Polypropylene</option>
                  <option value="wood">Wood</option>
                  <option value="fabric">Fabric</option>
                </select>
              </Field>
              <Field label="Delivery destination">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  placeholder="City, e.g. Sofia"
                />
              </Field>
              <Field label="Latest acceptable delivery">
                <input
                  type="date"
                  required
                  value={form.latestDelivery}
                  onChange={(e) => set("latestDelivery", e.target.value)}
                />
              </Field>
              <label className="checkbox-row span-2">
                <input
                  type="checkbox"
                  checked={form.stackable}
                  onChange={(e) => set("stackable", e.target.checked)}
                />
                <span>Chairs must be stackable</span>
              </label>
              <Field
                label="Original description"
                privateField
                className="span-2"
                hint="Private to your workspace. Only reviewed structured specifications are disclosed and matched."
              >
                <textarea
                  required
                  minLength={3}
                  maxLength={3000}
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
            {unsupported && (
              <div className="notice warning unsupported-notice">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resolved}
                    onChange={(e) => setResolved(e.target.checked)}
                  />
                  <span>
                    I have resolved unsupported requirements. The structured
                    specifications above are the complete requirements for this
                    purchase.
                  </span>
                </label>
              </div>
            )}
            <div className="private-panel">
              <div className="private-heading">
                <LockKeyhole size={17} />
                <b>Your private buying rules</b>
                <span>Visible only to your workspace</span>
              </div>
              <div className="form-grid">
                <Field
                  label="Maximum total budget (€)"
                  hint="Includes delivery and the configured final tax-inclusive price."
                >
                  <input
                    required
                    type="number"
                    min={0.01}
                    max={1000000}
                    step="0.01"
                    value={form.maxBudget}
                    onChange={(e) => set("maxBudget", e.target.value)}
                  />
                </Field>
                <Field label="Maximum deposit (%)">
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={form.maxDeposit}
                    onChange={(e) => set("maxDeposit", Number(e.target.value))}
                  />
                </Field>
                <Field
                  label="Offer preference"
                  className="span-2"
                  hint="Best fit is ranked by this preference, with total price breaking ties."
                >
                  <select
                    value={form.preference}
                    onChange={(e) =>
                      set(
                        "preference",
                        e.target.value as RequestInput["preference"],
                      )
                    }
                  >
                    <option value="lower_deposit">Lower deposit</option>
                    <option value="lowest_total">Lowest total price</option>
                    <option value="earliest_delivery">Earliest delivery</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {!draft && (
              <Button kind="ghost" type="button" onClick={() => setStep(1)}>
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
            <div className="button-group">
              <Button type="submit" value="draft" kind="secondary" busy={busy}>
                Save draft
              </Button>
              <Button
                type="submit"
                value="launch"
                busy={busy}
                disabled={unsupported && !resolved}
              >
                Save & find suppliers
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
