import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import JSZip from "jszip";

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [company, users, projects, timeEntries] = await Promise.all([
      db.company.findUnique({ where: { id: user.companyId } }),
      db.user.findMany({ where: { companyId: user.companyId } }),
      db.project.findMany({ where: { companyId: user.companyId } }),
      db.timeEntry.findMany({
        where: { companyId: user.companyId },
        include: { user: true, project: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const zip = new JSZip();

    // Users CSV
    const userHeaders = ["ID", "Email", "First Name", "Last Name", "Role", "Hourly Rate", "Cost Rate", "Weekly Target"];
    const userRows = users.map((u) => [
      u.id, u.email, u.firstName || "", u.lastName || "", u.role,
      u.hourlyRate.toString(), u.costRate.toString(), u.weeklyTarget.toString(),
    ]);
    zip.file("users.csv", toCsv(userHeaders, userRows));

    // Projects CSV
    const projectHeaders = ["ID", "Name", "Client", "Color", "Budget Hours", "Billable", "Active"];
    const projectRows = projects.map((p) => [
      p.id, p.name, p.client || "", p.color, p.budgetHours?.toString() || "",
      p.billable.toString(), p.active.toString(),
    ]);
    zip.file("projects.csv", toCsv(projectHeaders, projectRows));

    // Time Entries CSV
    const entryHeaders = ["ID", "Date", "Hours", "Comment", "User Email", "User Name", "Project", "Billable"];
    const entryRows = timeEntries.map((e) => [
      e.id, e.date.toISOString().split("T")[0], e.hours.toString(),
      e.comment || "", e.user.email,
      `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim(),
      e.project.name, e.project.billable.toString(),
    ]);
    zip.file("time-entries.csv", toCsv(entryHeaders, entryRows));

    // Metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      company: company?.name || "",
      totalUsers: users.length,
      totalProjects: projects.length,
      totalTimeEntries: timeEntries.length,
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    // README
    zip.file(
      "README.txt",
      `TimeTrack Data Export\n` +
      `====================\n\n` +
      `Company: ${company?.name || ""}\n` +
      `Export Date: ${new Date().toISOString()}\n\n` +
      `Files:\n` +
      `- users.csv: All team members\n` +
      `- projects.csv: All projects\n` +
      `- time-entries.csv: All time entries\n` +
      `- metadata.json: Export metadata\n`
    );

    const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="timetrack-backup-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    });
  } catch (error) {
    console.error("[ADMIN_EXPORT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
