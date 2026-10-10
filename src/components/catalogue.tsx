"use client";
import { useState } from "react";
import { Armchair, LockKeyhole, Pencil, Truck, Warehouse } from "lucide-react";
import type { Product, Policy } from "@/lib/types";
import { fmtMoney } from "@/lib/types";
import { api, Button, Empty, ErrorBox, Field, Modal, SectionTitle } from "./ui";
export type CatalogueEntry = { product: Product; policy: Policy };
function ProductEditor({
  entry,
  onClose,
  onUpdate,
}: {
  entry: CatalogueEntry;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}) {
  const [product, setProduct] = useState({
    ...entry.product,
    unitPrice: entry.product.unitPrice / 100,
    deliveryCharge: entry.product.deliveryCharge / 100,
  });
  const [policy, setPolicy] = useState({
    ...entry.policy,
    minUnitPrice: entry.policy.minUnitPrice / 100,
  });
  const [destinations, setDestinations] = useState(
    product.destinations.join(", "),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id, workspaceId, supplierName, ...fields } = product;
      void id;
      void workspaceId;
      void supplierName;
      await api(`/api/catalogue/${entry.product.id}`, "PATCH", {
        product: {
          ...fields,
          unitPrice: Math.round(product.unitPrice * 100),
          deliveryCharge: Math.round(product.deliveryCharge * 100),
          destinations: destinations
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        },
        policy: {
          ...policy,
          minUnitPrice: Math.round(policy.minUnitPrice * 100),
        },
      });
      await onUpdate();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const update = (key: string, value: string | number | boolean) =>
    setProduct((p) => ({ ...p, [key]: value }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit listing & agent rules"
      description="Public product facts and private commercial boundaries stay separate."
      wide
    >
      <form onSubmit={save}>
        <div className="form-body">
          <ErrorBox error={error} />
          <h3 className="form-section-heading">Public catalogue details</h3>
          <div className="form-grid">
            <Field label="Product name" className="span-2">
              <input
                value={product.name}
                required
                minLength={3}
                maxLength={100}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="SKU">
              <input
                value={product.sku}
                required
                minLength={2}
                maxLength={40}
                onChange={(e) => update("sku", e.target.value)}
              />
            </Field>
            <Field label="Material">
              <select
                value={product.material}
                onChange={(e) => update("material", e.target.value)}
              >
                <option value="polypropylene">Polypropylene</option>
                <option value="wood">Wood</option>
                <option value="fabric">Fabric</option>
              </select>
            </Field>
            <Field label="Color">
              <input
                required
                minLength={2}
                maxLength={40}
                value={product.color}
                onChange={(e) => update("color", e.target.value)}
              />
            </Field>
            <Field label="Available stock">
              <input
                type="number"
                required
                min={0}
                max={100000}
                value={product.stock}
                onChange={(e) => update("stock", Number(e.target.value))}
              />
            </Field>
            <Field label="Public unit price (€)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={product.unitPrice}
                onChange={(e) => update("unitPrice", Number(e.target.value))}
              />
            </Field>
            <Field label="Delivery charge (€)">
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={product.deliveryCharge}
                onChange={(e) =>
                  update("deliveryCharge", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Delivery lead time (days)">
              <input
                required
                type="number"
                min={1}
                max={90}
                value={product.leadDays}
                onChange={(e) => update("leadDays", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Delivery destinations"
              hint="Separate cities with commas."
            >
              <input
                required
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
              />
            </Field>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={product.stackable}
                onChange={(e) => update("stackable", e.target.checked)}
              />
              Stackable chairs
            </label>
          </div>
          <div className="private-panel">
            <div className="private-heading">
              <LockKeyhole size={17} />
              <b>Private commercial rules</b>
              <span>Your workspace only</span>
            </div>
            <div className="form-grid">
              <Field label="Minimum unit price (€)">
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={policy.minUnitPrice}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      minUnitPrice: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Minimum deposit (%)">
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={policy.minDeposit}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      minDeposit: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Discount starts at quantity">
                <input
                  type="number"
                  required
                  min={1}
                  max={10000}
                  value={policy.discountMinQuantity}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      discountMinQuantity: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Maximum discount (%)">
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={policy.maxDiscountPercent}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      maxDiscountPercent: Number(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>
            <p className="fine-print">
              The sales agent must satisfy both the price floor and maximum
              discount. Changes are checked again at approval.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <Button type="button" kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Save listing & rules
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function Catalogue({
  entries,
  onUpdate,
}: {
  entries: CatalogueEntry[];
  onUpdate: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<CatalogueEntry | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SELLER WORKSPACE</div>
          <h1>Catalogue & agent rules</h1>
          <p>
            Set the facts. Define the boundaries. Let your sales agent
            negotiate.
          </p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="panel">
          <Empty
            icon={<Armchair size={30} />}
            title="No catalogue listings"
            description="Reset demo data from Demo tools to restore the seeded seller catalogue."
          />
        </div>
      ) : (
        entries.map((entry) => (
          <div className="catalogue-layout" key={entry.product.id}>
            <section className="panel product-panel">
              <SectionTitle
                title="Public listing"
                action={
                  <Button kind="secondary" onClick={() => setEditing(entry)}>
                    <Pencil size={15} />
                    Edit listing
                  </Button>
                }
              />
              <div className="product-hero">
                <div className="chair-illustration">
                  <Armchair size={82} strokeWidth={1.15} />
                </div>
                <div>
                  <span className="category-tag">OFFICE FURNITURE</span>
                  <h2>{entry.product.name}</h2>
                  <p>{entry.product.sku}</p>
                  <div className="product-tags">
                    <span>{entry.product.material}</span>
                    <span>{entry.product.color}</span>
                    {entry.product.stackable && <span>Stackable</span>}
                  </div>
                </div>
              </div>
              <div className="product-stats">
                <div>
                  <Warehouse size={19} />
                  <span>Available stock</span>
                  <b>
                    {entry.product.stock}
                    <small> units</small>
                  </b>
                </div>
                <div>
                  <Truck size={19} />
                  <span>Delivery lead time</span>
                  <b>
                    {entry.product.leadDays}
                    <small> days</small>
                  </b>
                </div>
                <div>
                  <span>Public unit price</span>
                  <b>{fmtMoney(entry.product.unitPrice)}</b>
                  <small>Final price, tax included</small>
                </div>
              </div>
              <dl className="listing-details">
                <div>
                  <dt>Delivery charge</dt>
                  <dd>{fmtMoney(entry.product.deliveryCharge)}</dd>
                </div>
                <div>
                  <dt>Delivery destinations</dt>
                  <dd>{entry.product.destinations.join(", ")}</dd>
                </div>
                <div>
                  <dt>Supplier</dt>
                  <dd>{entry.product.supplierName}</dd>
                </div>
              </dl>
            </section>
            <aside className="panel rules-panel">
              <div className="rules-lock">
                <LockKeyhole size={21} />
              </div>
              <h2>Private agent rules</h2>
              <p>
                Only your workspace and your sales agent can access these
                limits.
              </p>
              <dl className="rule-list">
                <div>
                  <dt>Minimum unit price</dt>
                  <dd>{fmtMoney(entry.policy.minUnitPrice)}</dd>
                </div>
                <div>
                  <dt>Minimum deposit</dt>
                  <dd>{entry.policy.minDeposit}%</dd>
                </div>
                <div>
                  <dt>Discount eligible from</dt>
                  <dd>{entry.policy.discountMinQuantity} units</dd>
                </div>
                <div>
                  <dt>Maximum discount</dt>
                  <dd>{entry.policy.maxDiscountPercent}%</dd>
                </div>
              </dl>
              <Button
                kind="secondary"
                onClick={() => setEditing(entry)}
                className="full-width"
              >
                <Pencil size={15} />
                Edit commercial rules
              </Button>
              <p className="fine-print">
                Every proposed offer is validated against your rules before
                being shared.
              </p>
            </aside>
          </div>
        ))
      )}
      {editing && (
        <ProductEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
