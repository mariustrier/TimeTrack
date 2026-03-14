"use client";

import { useState } from "react";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const [activeTab, setActiveTab] = useState("projects");

  return (
    <div>
      <PageGuide
        pageId="projects"
        titleKey="projectsTitle"
        descKey="projectsDesc"
        tips={["projectsTip1", "projectsTip2", "projectsTip3"]}
      />
      <PageHeader
        title={t("title")}
        tabs={[
          { key: "projects", label: t("projectsTab") },
          { key: "timeline", label: t("timelineTab") },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "projects" && <ProjectsList />}
      {activeTab === "timeline" && <ProjectTimeline />}
    </div>
  );
}
