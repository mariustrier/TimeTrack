export const BILLING_COLORS: Record<string, string> = {
  billable: "#10B981",
  included: "#6366F1",
  non_billable: "#F59E0B",
  internal: "#8B5CF6",
  presales: "#3B82F6",
};

export const METRIC_COLORS = {
  revenue: "#10B981",
  cost: "#EF4444",
  profit: "#6366F1",
  overhead: "#F97316",
  target: "#9CA3AF",
  margin: "#8B5CF6",
  billableUtil: "#10B981",
  totalUtil: "#6366F1",
};

export const SERIES_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#3B82F6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
];

export const BILLING_STATUS_ORDER = [
  "billable",
  "included",
  "non_billable",
  "internal",
  "presales",
] as const;

export type BillingStatus = (typeof BILLING_STATUS_ORDER)[number];
