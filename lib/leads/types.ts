export interface GatingInfo {
  ungatedMostAccounts: boolean;
  hazmat: boolean;
  meltableSeasonal: boolean;
  ipComplaintProneBrand: boolean;
}

export interface Lead {
  id: string;
  asin: string;
  title: string;
  category: string;
  supplierName: string;
  supplierUrl: string;
  amazonUrl: string;
  buyCost: number;
  sellPrice: number;
  fees: number;
  fbaSellerCount: number;
  amazonInBuyBoxSharePct: number; // % of last 90 days Amazon held the Buy Box
  monthlyDropCount: number; // raw Keepa-style sales-rank-drop signal
  estMonthlySales: number; // derived "real velocity" from drop count, not raw BSR
  gating: GatingInfo;
  firstSeen: string; // ISO timestamp, first time this ASIN was sourced
  lastPriceCheck: string; // ISO timestamp of last (simulated) live re-check
}

export interface Filters {
  minROIPct: number;
  minProfit: number;
  maxBuyCost: number;
  categories: string[]; // empty = all categories
  excludeGatedCategories: boolean;
  maxFbaSellers: number;
  excludeAmazonInBuyBox: boolean;
  amazonBuyBoxThresholdPct: number;
  showHiddenDuplicates: boolean;
}

export interface DedupeRecord {
  profit: number;
  roi: number;
  seenAt: string;
}

export type DedupeMap = Record<string, DedupeRecord>;

export interface Outcome {
  id: string;
  leadId: string;
  asin: string;
  title: string;
  buyCost: number;
  qty: number;
  actualSellPrice: number;
  fees: number;
  loggedAt: string; // ISO timestamp
}
