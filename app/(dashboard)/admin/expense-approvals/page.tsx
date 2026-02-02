import { redirect } from "next/navigation";

export default function ExpenseApprovalsRedirect() {
  redirect("/admin/approvals");
}
