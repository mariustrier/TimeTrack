import type { AccountingAdapter, AccountingCredentials } from "./types";
import { EconomicAdapter } from "./e-conomic";
import { BillyAdapter } from "./billy";
import { DineroAdapter } from "./dinero";

export function getAccountingAdapter(credentials: AccountingCredentials): AccountingAdapter {
  switch (credentials.system) {
    case "e-conomic":
      return new EconomicAdapter(credentials);
    case "billy":
      return new BillyAdapter(credentials);
    case "dinero":
      return new DineroAdapter(credentials);
    default:
      throw new Error(`Unknown accounting system: ${(credentials as { system: string }).system}`);
  }
}
