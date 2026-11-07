import type { DedupeMap, Filters, Lead, Outcome } from "./types";

export const DEFAULT_FILTERS: Filters = {
  minROIPct: 25,
  minProfit: 2.5,
  maxBuyCost: 75,
  categories: [],
  excludeGatedCategories: true,
  maxFbaSellers: 10,
  excludeAmazonInBuyBox: true,
  amazonBuyBoxThresholdPct: 20,
  showHiddenDuplicates: false,
};

// Minimum improvement (as a fraction of previously-seen profit) required
// before we show an ASIN we've already surfaced before.
const DEDUPE_IMPROVEMENT_THRESHOLD = 0.15;

export function profitOf(lead: Lead): number {
  return round2(lead.sellPrice - lead.fees - lead.buyCost);
}

export function roiOf(lead: Lead): number {
  if (lead.buyCost <= 0) return 0;
  return round2((profitOf(lead) / lead.buyCost) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Northern-hemisphere "meltable season" window: May through September.
export function isMeltSeason(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 0 = Jan
  return month >= 4 && month <= 8;
}

export interface GatingResult {
  passed: boolean;
  reasons: string[];
}

// The hard gate every lead must clear before it's ever shown, independent of
// the user's own buying-criteria filters below.
export function checkGating(lead: Lead, filters: Filters): GatingResult {
  const reasons: string[] = [];

  if (filters.excludeGatedCategories && !lead.gating.ungatedMostAccounts) {
    reasons.push("Category is gated for most seller accounts");
  }
  if (lead.gating.hazmat) {
    reasons.push("Flagged hazmat / dangerous goods");
  }
  if (lead.gating.meltableSeasonal && isMeltSeason()) {
    reasons.push("Meltable item during active melt season");
  }
  if (lead.gating.ipComplaintProneBrand) {
    reasons.push("Brand has a history of IP complaints");
  }
  if (
    filters.excludeAmazonInBuyBox &&
    lead.amazonInBuyBoxSharePct > filters.amazonBuyBoxThresholdPct
  ) {
    reasons.push(
      `Amazon holds the Buy Box ${lead.amazonInBuyBoxSharePct}% of the last 90 days (limit ${filters.amazonBuyBoxThresholdPct}%)`
    );
  }

  return { passed: reasons.length === 0, reasons };
}

export function passesBuyingCriteria(lead: Lead, filters: Filters): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const roi = roiOf(lead);
  const profit = profitOf(lead);

  if (roi < filters.minROIPct) reasons.push(`ROI ${roi}% below your ${filters.minROIPct}% minimum`);
  if (profit < filters.minProfit) reasons.push(`Profit $${profit.toFixed(2)} below your $${filters.minProfit.toFixed(2)} minimum`);
  if (lead.buyCost > filters.maxBuyCost) reasons.push(`Buy cost $${lead.buyCost.toFixed(2)} above your $${filters.maxBuyCost.toFixed(2)} max`);
  if (lead.fbaSellerCount > filters.maxFbaSellers) reasons.push(`${lead.fbaSellerCount} competing FBA sellers exceeds your max of ${filters.maxFbaSellers}`);
  if (filters.categories.length > 0 && !filters.categories.includes(lead.category)) {
    reasons.push(`Category "${lead.category}" not in your selected categories`);
  }

  return { passed: reasons.length === 0, reasons };
}

// "Real velocity": cap the raw Keepa-style drop-derived estimate by how many
// FBA sellers are splitting the Buy Box, instead of quoting raw BSR.
export function estimatedUserMonthlyUnits(lead: Lead): number {
  const share = lead.estMonthlySales / Math.max(1, lead.fbaSellerCount);
  return Math.max(1, Math.round(share));
}

export interface LeadReason {
  why: string;
  risk: string;
}

export function generateReason(lead: Lead, filters: Filters): LeadReason {
  const roi = roiOf(lead);
  const profit = profitOf(lead);
  const yourUnits = estimatedUserMonthlyUnits(lead);

  const why = `Passed because ROI is ${roi}% (min ${filters.minROIPct}%), profit is $${profit.toFixed(2)}/unit, and Amazon has held the Buy Box only ${lead.amazonInBuyBoxSharePct}% of the last 90 days.`;

  const risks: string[] = [];
  if (lead.fbaSellerCount >= 6) {
    risks.push(`${lead.fbaSellerCount} other FBA sellers could compress margin fast if any of them restock deep`);
  }
  if (lead.amazonInBuyBoxSharePct > 0 && lead.amazonInBuyBoxSharePct <= 20) {
    risks.push(`Amazon has appeared in the Buy Box ${lead.amazonInBuyBoxSharePct}% of the time — watch for them re-entering`);
  }
  if (lead.gating.meltableSeasonal) {
    risks.push("Meltable — shipping/storage risk rises in warm months");
  }
  if (yourUnits < 15) {
    risks.push(`Estimated velocity is thin (~${yourUnits} units/mo at your share) — a small price move wipes the margin`);
  }
  if (risks.length === 0) {
    risks.push("No major red flags detected, but re-check price before committing capital");
  }

  return { why, risk: risks.join(". ") + "." };
}

export function shouldSuppressAsDuplicate(lead: Lead, dedupe: DedupeMap): boolean {
  const prior = dedupe[lead.asin];
  if (!prior) return false;
  const currentProfit = profitOf(lead);
  const baseline = Math.abs(prior.profit) || 1;
  const improvement = (currentProfit - prior.profit) / baseline;
  return improvement < DEDUPE_IMPROVEMENT_THRESHOLD;
}

export function recordDedupe(lead: Lead, dedupe: DedupeMap): DedupeMap {
  const currentProfit = profitOf(lead);
  const prior = dedupe[lead.asin];
  if (prior && prior.profit >= currentProfit) return dedupe;
  return {
    ...dedupe,
    [lead.asin]: { profit: currentProfit, roi: roiOf(lead), seenAt: new Date().toISOString() },
  };
}

export function actualProfitOf(outcome: Outcome): number {
  return round2((outcome.actualSellPrice - outcome.fees - outcome.buyCost) * outcome.qty);
}

export function profitSurfacedInMonth(outcomes: Outcome[], year: number, month: number): number {
  return round2(
    outcomes
      .filter((o) => {
        const d = new Date(o.loggedAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, o) => sum + actualProfitOf(o), 0)
  );
}

// Simulated live re-check: nudges price/fees within a plausible hourly drift
// range and occasionally lets Amazon slip into the Buy Box, standing in for a
// real Keepa/SP-API price pull until one is wired up.
export function simulateLiveRecheck(lead: Lead): Lead {
  const priceDrift = (Math.random() - 0.5) * 0.08; // +/-4%
  const feeDrift = (Math.random() - 0.5) * 0.04; // +/-2%
  const amazonEntersBuyBox = Math.random() < 0.08;

  return {
    ...lead,
    sellPrice: round2(lead.sellPrice * (1 + priceDrift)),
    fees: round2(lead.fees * (1 + feeDrift)),
    amazonInBuyBoxSharePct: amazonEntersBuyBox
      ? Math.min(100, lead.amazonInBuyBoxSharePct + 25)
      : lead.amazonInBuyBoxSharePct,
    lastPriceCheck: new Date().toISOString(),
  };
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
