"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { buildMockLeads } from "@/lib/leads/data";
import {
  DEFAULT_FILTERS,
  checkGating,
  estimatedUserMonthlyUnits,
  generateReason,
  passesBuyingCriteria,
  profitOf,
  profitSurfacedInMonth,
  recordDedupe,
  roiOf,
  shouldSuppressAsDuplicate,
  simulateLiveRecheck,
  timeAgo,
} from "@/lib/leads/engine";
import type { DedupeMap, Filters, Lead, Outcome } from "@/lib/leads/types";
import { loadJSON, saveJSON } from "@/lib/storage";

const DEDUPE_KEY = "arbiai.dedupe.v1";
const OUTCOMES_KEY = "arbiai.outcomes.v1";

type LeadRow = Lead & { isDuplicate: boolean };

function computeInitialRows(): { rows: LeadRow[]; dedupe: DedupeMap } {
  const raw = buildMockLeads();
  const storedDedupe = loadJSON<DedupeMap>(DEDUPE_KEY, {});
  let dedupe = storedDedupe;
  const rows: LeadRow[] = raw.map((lead) => {
    const isDuplicate = shouldSuppressAsDuplicate(lead, dedupe);
    if (!isDuplicate) dedupe = recordDedupe(lead, dedupe);
    return { ...lead, isDuplicate };
  });
  return { rows, dedupe };
}

export default function LeadFeedPage() {
  const [{ rows: initialRows, dedupe: initialDedupe }] = useState(computeInitialRows);
  const [leads, setLeads] = useState<LeadRow[]>(initialRows);
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => loadJSON<Outcome[]>(OUTCOMES_KEY, []));
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rechecking, setRechecking] = useState<Record<string, boolean>>({});
  const [openOverlayId, setOpenOverlayId] = useState<string | null>(null);
  const [openBuyFormId, setOpenBuyFormId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{ qty: string; sellPrice: string; fees: string }>({
    qty: "1",
    sellPrice: "",
    fees: "",
  });
  const [lastLogged, setLastLogged] = useState<string | null>(null);

  useEffect(() => {
    saveJSON(DEDUPE_KEY, initialDedupe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(leads.map((l) => l.category))).sort(),
    [leads]
  );

  const pipeline = useMemo(() => {
    const gatingChecked = leads.map((lead) => ({ lead, gating: checkGating(lead, filters) }));
    const gatedOutCount = gatingChecked.filter((x) => !x.gating.passed).length;
    const afterGating = gatingChecked.filter((x) => x.gating.passed).map((x) => x.lead);

    const hiddenDuplicateCount = afterGating.filter((l) => l.isDuplicate).length;
    const afterDedupe = filters.showHiddenDuplicates
      ? afterGating
      : afterGating.filter((l) => !l.isDuplicate);

    const criteriaChecked = afterDedupe.map((lead) => ({
      lead,
      crit: passesBuyingCriteria(lead, filters),
    }));
    const shown = criteriaChecked
      .filter((x) => x.crit.passed)
      .map((x) => x.lead)
      .sort((a, b) => profitOf(b) - profitOf(a));
    const filteredOutByCriteria = criteriaChecked.filter((x) => !x.crit.passed);

    return { gatedOutCount, hiddenDuplicateCount, shown, filteredOutByCriteria };
  }, [leads, filters]);

  const now = new Date();
  const profitThisMonth = profitSurfacedInMonth(outcomes, now.getFullYear(), now.getMonth());
  const avgRoiShown = pipeline.shown.length
    ? Math.round(pipeline.shown.reduce((s, l) => s + roiOf(l), 0) / pipeline.shown.length)
    : 0;

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function toggleCategory(cat: string) {
    setFilters((f) => {
      const has = f.categories.includes(cat);
      return { ...f, categories: has ? f.categories.filter((c) => c !== cat) : [...f.categories, cat] };
    });
  }

  function handleRecheck(id: string) {
    setRechecking((r) => ({ ...r, [id]: true }));
    setTimeout(() => {
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...simulateLiveRecheck(l), isDuplicate: l.isDuplicate } : l))
      );
      setRechecking((r) => ({ ...r, [id]: false }));
    }, 450);
  }

  function openBuyForm(lead: LeadRow) {
    setOpenBuyFormId(lead.id);
    setBuyForm({ qty: "1", sellPrice: String(lead.sellPrice), fees: String(lead.fees) });
    setLastLogged(null);
  }

  function submitBuyForm(lead: LeadRow) {
    const qty = Math.max(1, Number(buyForm.qty) || 1);
    const sellPrice = Number(buyForm.sellPrice) || lead.sellPrice;
    const fees = Number(buyForm.fees) || lead.fees;
    const outcome: Outcome = {
      id: `${lead.id}-${Date.now()}`,
      leadId: lead.id,
      asin: lead.asin,
      title: lead.title,
      buyCost: lead.buyCost,
      qty,
      actualSellPrice: sellPrice,
      fees,
      loggedAt: new Date().toISOString(),
    };
    const next = [...outcomes, outcome];
    setOutcomes(next);
    saveJSON(OUTCOMES_KEY, next);
    const profit = (sellPrice - fees - lead.buyCost) * qty;
    setLastLogged(`Logged ${qty}x ${lead.title.slice(0, 28)}… → +$${profit.toFixed(2)} profit`);
    setOpenBuyFormId(null);
  }

  function exportCSV() {
    const header = [
      "asin",
      "title",
      "category",
      "supplier_url",
      "amazon_url",
      "buy_cost",
      "sell_price",
      "fees",
      "profit",
      "roi_pct",
      "est_monthly_sales_market",
      "est_your_monthly_units",
      "fba_seller_count",
      "amazon_buybox_share_pct",
    ];
    const lines = pipeline.shown.map((l) =>
      [
        l.asin,
        `"${l.title.replace(/"/g, '""')}"`,
        l.category,
        l.supplierUrl,
        l.amazonUrl,
        l.buyCost,
        l.sellPrice,
        l.fees,
        profitOf(l),
        roiOf(l),
        l.estMonthlySales,
        estimatedUserMonthlyUnits(l),
        l.fbaSellerCount,
        l.amazonInBuyBoxSharePct,
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arbiai-buy-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={pageShell}>
      <header style={topBar}>
        <div>
          <Link href="/" style={backLink}>
            ← Dashboard
          </Link>
          <h1 style={topTitle}>Lead Feed</h1>
          <p style={topSub}>
            {leads.length} sourced today · {pipeline.shown.length} cleared gating, dedupe &amp; your filters
          </p>
        </div>
        <button style={primaryButton} onClick={exportCSV}>
          ⬇ Export buy list (CSV)
        </button>
      </header>

      <section style={statsRow}>
        <StatCard label="Sourced today" value={String(leads.length)} chip="Simulated daily batch" />
        <StatCard label="Passed gating" value={String(leads.length - pipeline.gatedOutCount)} chip={`${pipeline.gatedOutCount} blocked`} />
        <StatCard label="Avg ROI (shown)" value={`${avgRoiShown}%`} chip={`${pipeline.shown.length} in feed`} />
        <StatCard
          label="Profit surfaced this month"
          value={`$${profitThisMonth.toFixed(2)}`}
          chip={`${outcomes.length} outcomes logged`}
        />
      </section>

      <div style={contentGrid}>
        <FilterPanel filters={filters} categories={categories} onChange={updateFilter} onToggleCategory={toggleCategory} hiddenDuplicateCount={pipeline.hiddenDuplicateCount} />

        <section style={feedCol}>
          {pipeline.shown.length === 0 && (
            <div style={emptyState}>
              No leads clear your current filters. Loosen min ROI/profit or the Buy Box exclusion in the panel on the left.
            </div>
          )}

          {pipeline.shown.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              filters={filters}
              isRechecking={!!rechecking[lead.id]}
              onRecheck={() => handleRecheck(lead.id)}
              overlayOpen={openOverlayId === lead.id}
              onToggleOverlay={() => setOpenOverlayId(openOverlayId === lead.id ? null : lead.id)}
              buyFormOpen={openBuyFormId === lead.id}
              onOpenBuyForm={() => openBuyForm(lead)}
              onCancelBuyForm={() => setOpenBuyFormId(null)}
              buyForm={buyForm}
              onBuyFormChange={setBuyForm}
              onSubmitBuyForm={() => submitBuyForm(lead)}
              lastLogged={openBuyFormId === null ? lastLogged : null}
            />
          ))}

          {pipeline.filteredOutByCriteria.length > 0 && (
            <details style={filteredOutBox}>
              <summary style={filteredOutSummary}>
                {pipeline.filteredOutByCriteria.length} more sourced leads didn&apos;t meet your filters
              </summary>
              <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                {pipeline.filteredOutByCriteria.map(({ lead, crit }) => (
                  <li key={lead.id} style={{ fontSize: 12, color: "#999" }}>
                    <span style={{ color: "#ccc" }}>{lead.title}</span> — {crit.reasons.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Filter panel ---------------- */

function FilterPanel({
  filters,
  categories,
  onChange,
  onToggleCategory,
  hiddenDuplicateCount,
}: {
  filters: Filters;
  categories: string[];
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onToggleCategory: (cat: string) => void;
  hiddenDuplicateCount: number;
}) {
  return (
    <aside style={filterPanel}>
      <h2 style={panelTitle}>Buying criteria</h2>
      <p style={panelSub}>Drives sourcing display, not just cosmetics — leads outside these never make your feed.</p>

      <FieldNumber label="Min ROI %" value={filters.minROIPct} onChange={(v) => onChange("minROIPct", v)} />
      <FieldNumber label="Min profit $" value={filters.minProfit} step={0.5} onChange={(v) => onChange("minProfit", v)} />
      <FieldNumber label="Max buy cost $" value={filters.maxBuyCost} step={1} onChange={(v) => onChange("maxBuyCost", v)} />
      <FieldNumber label="Max FBA sellers" value={filters.maxFbaSellers} onChange={(v) => onChange("maxFbaSellers", v)} />

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={filters.excludeGatedCategories}
          onChange={(e) => onChange("excludeGatedCategories", e.target.checked)}
        />
        Exclude gated / hazmat / IP-risk categories
      </label>

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={filters.excludeAmazonInBuyBox}
          onChange={(e) => onChange("excludeAmazonInBuyBox", e.target.checked)}
        />
        Exclude if Amazon is in the Buy Box &gt;
        <input
          type="number"
          value={filters.amazonBuyBoxThresholdPct}
          onChange={(e) => onChange("amazonBuyBoxThresholdPct", Number(e.target.value))}
          style={inlineNumberInput}
        />
        %
      </label>

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={filters.showHiddenDuplicates}
          onChange={(e) => onChange("showHiddenDuplicates", e.target.checked)}
        />
        Show duplicate ASINs ({hiddenDuplicateCount} hidden — margin hasn&apos;t improved enough)
      </label>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Categories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {categories.map((cat) => {
            const active = filters.categories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                style={{ ...chip, ...(active ? chipActive : {}) }}
              >
                {cat}
              </button>
            );
          })}
        </div>
        {filters.categories.length === 0 && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>None selected = all categories</div>
        )}
      </div>
    </aside>
  );
}

function FieldNumber({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={fieldRow}>
      <span style={fieldLabel}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={fieldInput}
      />
    </div>
  );
}

/* ---------------- Lead card ---------------- */

function LeadCard({
  lead,
  filters,
  isRechecking,
  onRecheck,
  overlayOpen,
  onToggleOverlay,
  buyFormOpen,
  onOpenBuyForm,
  onCancelBuyForm,
  buyForm,
  onBuyFormChange,
  onSubmitBuyForm,
  lastLogged,
}: {
  lead: Lead;
  filters: Filters;
  isRechecking: boolean;
  onRecheck: () => void;
  overlayOpen: boolean;
  onToggleOverlay: () => void;
  buyFormOpen: boolean;
  onOpenBuyForm: () => void;
  onCancelBuyForm: () => void;
  buyForm: { qty: string; sellPrice: string; fees: string };
  onBuyFormChange: (f: { qty: string; sellPrice: string; fees: string }) => void;
  onSubmitBuyForm: () => void;
  lastLogged: string | null;
}) {
  const profit = profitOf(lead);
  const roi = roiOf(lead);
  const yourUnits = estimatedUserMonthlyUnits(lead);
  const reason = generateReason(lead, filters);
  const isDead = profit <= 0;

  return (
    <div style={leadCard}>
      <div style={leadHeaderRow}>
        <div>
          <div style={leadTitle}>{lead.title}</div>
          <div style={leadMeta}>
            {lead.asin} · {lead.category} · via {lead.supplierName}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...profitValue, color: isDead ? "#ff6b6b" : "#3BFF8F" }}>${profit.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>{roi}% ROI</div>
        </div>
      </div>

      {isDead && <div style={deadBanner}>⚠ Dead lead — margin went negative since sourcing. Recheck before buying.</div>}

      <div style={numbersGrid}>
        <NumberCell label="Buy cost" value={`$${lead.buyCost.toFixed(2)}`} />
        <NumberCell label="Sell price" value={`$${lead.sellPrice.toFixed(2)}`} />
        <NumberCell label="Fees" value={`$${lead.fees.toFixed(2)}`} />
        <NumberCell label="FBA sellers" value={String(lead.fbaSellerCount)} />
        <NumberCell label="Amazon in Buy Box" value={`${lead.amazonInBuyBoxSharePct}%`} />
        <NumberCell label="Your est. units/mo" value={`~${yourUnits}`} sub={`market ~${lead.estMonthlySales}/mo`} />
      </div>

      <div style={reasonBox}>
        <div style={reasonWhy}>✅ {reason.why}</div>
        <div style={reasonRisk}>⚠ {reason.risk}</div>
      </div>

      <div style={cardActions}>
        <a href={lead.supplierUrl} target="_blank" rel="noreferrer" style={linkButton}>
          Supplier ↗
        </a>
        <a href={lead.amazonUrl} target="_blank" rel="noreferrer" style={linkButton}>
          Amazon ↗
        </a>
        <button style={secondaryButton} onClick={onRecheck} disabled={isRechecking}>
          {isRechecking ? "Checking…" : `↻ Recheck price (${timeAgo(lead.lastPriceCheck)})`}
        </button>
        <button style={secondaryButton} onClick={onToggleOverlay}>
          {overlayOpen ? "Hide overlay preview" : "Preview page overlay"}
        </button>
        <button style={buyButton} onClick={onOpenBuyForm}>
          Mark as bought
        </button>
      </div>

      {overlayOpen && <OverlayPreview lead={lead} profit={profit} roi={roi} />}

      {buyFormOpen && (
        <div style={buyFormBox}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
            Log the real outcome so it counts toward your profit-surfaced total.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={miniField}>
              Qty
              <input
                type="number"
                min={1}
                value={buyForm.qty}
                onChange={(e) => onBuyFormChange({ ...buyForm, qty: e.target.value })}
                style={fieldInput}
              />
            </label>
            <label style={miniField}>
              Actual sell $
              <input
                type="number"
                value={buyForm.sellPrice}
                onChange={(e) => onBuyFormChange({ ...buyForm, sellPrice: e.target.value })}
                style={fieldInput}
              />
            </label>
            <label style={miniField}>
              Actual fees $
              <input
                type="number"
                value={buyForm.fees}
                onChange={(e) => onBuyFormChange({ ...buyForm, fees: e.target.value })}
                style={fieldInput}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={buyButton} onClick={onSubmitBuyForm}>
              Save outcome
            </button>
            <button style={secondaryButton} onClick={onCancelBuyForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!buyFormOpen && lastLogged && <div style={loggedNote}>✓ {lastLogged}</div>}
    </div>
  );
}

function OverlayPreview({ lead, profit, roi }: { lead: Lead; profit: number; roi: number }) {
  return (
    <div style={overlayPreviewBox}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
        Preview only — this is what an ArbiAI browser-extension overlay would show injected on the live
        Amazon/supplier page. It isn&apos;t live yet; shipping it for real needs a Chrome extension with
        page-content permissions, which is a separate build from this web app.
      </div>
      <div style={mockPageChrome}>
        <div style={mockPageBar}>amazon.com/dp/{lead.asin}</div>
        <div style={mockPageBody}>
          <div style={{ width: 90, height: 90, borderRadius: 8, background: "#1b1b25" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#ddd", marginBottom: 6 }}>{lead.title}</div>
            <div style={{ fontSize: 20, color: "#eee" }}>${lead.sellPrice.toFixed(2)}</div>
          </div>
          <div style={arbiOverlayBadge}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>ArbiAI</div>
            <div>Profit ${profit.toFixed(2)}</div>
            <div>ROI {roi}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#777" }}>{label}</div>
      <div style={{ fontSize: 14, color: "#eee" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#666" }}>{sub}</div>}
    </div>
  );
}

function StatCard({ label, value, chip }: { label: string; value: string; chip: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: "#999" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{value}</div>
      <div style={statChip}>{chip}</div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "#050509",
  color: "white",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const backLink: CSSProperties = { fontSize: 12, color: "#888", textDecoration: "none" };

const topBar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
};

const topTitle: CSSProperties = { fontSize: 24, fontWeight: 700, marginTop: 4 };
const topSub: CSSProperties = { fontSize: 13, color: "#aaa", marginTop: 4 };

const primaryButton: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "#3BFF8F",
  color: "#050509",
  fontWeight: 600,
  cursor: "pointer",
};

const statsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
};

const statCard: CSSProperties = {
  background: "#0c0d14",
  borderRadius: 14,
  padding: 14,
  border: "1px solid #1b1b25",
};

const statChip: CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "#3BFF8F",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#07140e",
  display: "inline-block",
};

const contentGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  gap: 18,
  alignItems: "start",
};

const filterPanel: CSSProperties = {
  background: "#0c0d14",
  borderRadius: 16,
  padding: 16,
  border: "1px solid #1b1b25",
  position: "sticky",
  top: 24,
};

const panelTitle: CSSProperties = { fontSize: 15, fontWeight: 600 };
const panelSub: CSSProperties = { fontSize: 12, color: "#888", marginTop: 4, marginBottom: 14 };

const fieldRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
};

const fieldLabel: CSSProperties = { fontSize: 12, color: "#bbb" };

const fieldInput: CSSProperties = {
  width: 64,
  borderRadius: 8,
  border: "1px solid #262739",
  background: "#131522",
  color: "white",
  fontSize: 12,
  padding: "5px 7px",
};

const inlineNumberInput: CSSProperties = {
  ...fieldInput,
  width: 46,
  margin: "0 4px",
};

const checkboxRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#bbb",
  marginBottom: 10,
  flexWrap: "wrap",
};

const chip: CSSProperties = {
  fontSize: 11,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #262739",
  background: "#10111c",
  color: "#aaa",
  cursor: "pointer",
};

const chipActive: CSSProperties = {
  border: "1px solid #3BFF8F66",
  background: "#07140e",
  color: "#3BFF8F",
};

const feedCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 14 };

const emptyState: CSSProperties = {
  padding: 24,
  borderRadius: 14,
  border: "1px dashed #262739",
  color: "#999",
  fontSize: 13,
  textAlign: "center",
};

const leadCard: CSSProperties = {
  background: "#0c0d14",
  borderRadius: 16,
  padding: 16,
  border: "1px solid #1b1b25",
};

const leadHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const leadTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: "#f2f2f2" };
const leadMeta: CSSProperties = { fontSize: 12, color: "#888", marginTop: 4 };
const profitValue: CSSProperties = { fontSize: 20, fontWeight: 700 };

const deadBanner: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 8,
  background: "#1a0d0d",
  border: "1px solid #3a1f1f",
  color: "#ff8f8f",
  fontSize: 12,
};

const numbersGrid: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 10,
};

const reasonBox: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 10,
  background: "#10111c",
  border: "1px solid #1d1e2a",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const reasonWhy: CSSProperties = { fontSize: 12, color: "#9be8b7" };
const reasonRisk: CSSProperties = { fontSize: 12, color: "#e8c99b" };

const cardActions: CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const linkButton: CSSProperties = {
  fontSize: 12,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #262739",
  background: "#10111c",
  color: "#aaa",
  textDecoration: "none",
};

const secondaryButton: CSSProperties = {
  fontSize: 12,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #262739",
  background: "#10111c",
  color: "#ccc",
  cursor: "pointer",
};

const buyButton: CSSProperties = {
  fontSize: 12,
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: "#3BFF8F",
  color: "#050509",
  fontWeight: 600,
  cursor: "pointer",
};

const buyFormBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: "#10111c",
  border: "1px solid #1d1e2a",
};

const miniField: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "#999",
};

const loggedNote: CSSProperties = { marginTop: 10, fontSize: 12, color: "#3BFF8F" };

const overlayPreviewBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: "#0a0b12",
  border: "1px dashed #262739",
};

const mockPageChrome: CSSProperties = {
  borderRadius: 10,
  overflow: "hidden",
  border: "1px solid #262739",
};

const mockPageBar: CSSProperties = {
  background: "#1b1b25",
  color: "#888",
  fontSize: 11,
  padding: "6px 10px",
};

const mockPageBody: CSSProperties = {
  background: "#ffffff10",
  padding: 14,
  display: "flex",
  gap: 14,
  alignItems: "center",
  position: "relative",
};

const arbiOverlayBadge: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#07140e",
  border: "1px solid #3BFF8F66",
  color: "#3BFF8F",
  fontSize: 12,
  minWidth: 90,
};

const filteredOutBox: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #1b1b25",
  background: "#0a0b12",
};

const filteredOutSummary: CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  color: "#888",
};
