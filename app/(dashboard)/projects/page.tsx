"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";

export default function ProjectsPage() {
  const t = useTranslations("projects");

  return (
    <div className="space-y-6">
      <PageGuide
        pageId="projects"
        titleKey="projectsTitle"
        descKey="projectsDesc"
        tips={["projectsTip1", "projectsTip2", "projectsTip3"]}
      />
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <Tabs defaultValue="projects">
        <TabsList data-tour="projects-tabs">
          <TabsTrigger value="projects">{t("projectsTab")}</TabsTrigger>
          <TabsTrigger value="timeline" data-tour="projects-timeline-tab">{t("timelineTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="mt-6">
          <ProjectsList />
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
          <ProjectTimeline />
        </TabsContent>
      </Tabs>
    </div>
  );
}
