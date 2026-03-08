import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/management?tab=team");
}
