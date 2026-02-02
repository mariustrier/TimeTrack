import {
  eachMonthOfInterval,
  isWithinInterval,
  startOfMonth,
  addMonths,
  addQuarters,
  addYears,
  isBefore,
  isAfter,
} from "date-fns";

export const COMPANY_EXPENSE_CATEGORIES = [
  "rent",
  "insurance",
  "utilities",
  "software",
  "salaries",
  "other",
] as const;

export const PROJECT_EXPENSE_CATEGORIES = [
  "travel",
  "materials",
  "software",
  "meals",
  "other",
] as const;

export type CompanyExpenseCategory = (typeof COMPANY_EXPENSE_CATEGORIES)[number];
export type ProjectExpenseCategory = (typeof PROJECT_EXPENSE_CATEGORIES)[number];

interface RecurringExpense {
  amount: number;
  date: Date | string;
  category: string;
  description: string;
  recurring: boolean;
  frequency: string | null;
}

interface MaterializedExpense {
  amount: number;
  date: Date;
  category: string;
  description: string;
}

export function expandRecurringExpenses(
  expenses: RecurringExpense[],
  startDate: string | Date,
  endDate: string | Date
): MaterializedExpense[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const result: MaterializedExpense[] = [];

  for (const expense of expenses) {
    const expenseDate = new Date(expense.date);

    if (!expense.recurring) {
      // One-time expense: include if within range
      if (
        isWithinInterval(expenseDate, { start, end }) ||
        (expenseDate >= start && expenseDate <= end)
      ) {
        result.push({
          amount: expense.amount,
          date: expenseDate,
          category: expense.category,
          description: expense.description,
        });
      }
      continue;
    }

    // Recurring expense: generate instances from expense start date through end date
    const freq = expense.frequency || "monthly";
    let current = startOfMonth(expenseDate);

    while (!isAfter(current, end)) {
      if (!isBefore(current, start) && !isAfter(current, end)) {
        result.push({
          amount: expense.amount,
          date: new Date(current),
          category: expense.category,
          description: expense.description,
        });
      }

      if (freq === "monthly") {
        current = addMonths(current, 1);
      } else if (freq === "quarterly") {
        current = addQuarters(current, 1);
      } else if (freq === "yearly") {
        current = addYears(current, 1);
      } else {
        current = addMonths(current, 1);
      }
    }
  }

  return result;
}

export function shouldAutoApprove(
  amount: number,
  threshold: number | null
): boolean {
  if (threshold == null) return false;
  return amount <= threshold;
}
