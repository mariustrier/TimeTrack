"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamList } from "@/components/team/TeamList";
import { ResourcePlanner } from "@/components/team/ResourcePlanner";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";

export default function TeamPage() {
  const t = useTranslations("team");

  return (
    <div className="space-y-6">
      <PageGuide
        pageId="team"
        titleKey="teamTitle"
        descKey="teamDesc"
        tips={["teamTip1", "teamTip2", "teamTip3"]}
      />
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <Tabs defaultValue="team">
        <TabsList data-tour="team-tabs">
          <TabsTrigger value="team">{t("teamTab")}</TabsTrigger>
          <TabsTrigger value="resource-planner" data-tour="team-resource-tab">{t("resourcePlannerTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-6">
          <TeamList />
        </TabsContent>
        <TabsContent value="resource-planner" className="mt-6">
          <ResourcePlanner />
        </TabsContent>
      </Tabs>
    </div>
  );
}
