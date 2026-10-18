"use client";
import { useT } from "@/lib/i18n";

import { Mic } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { RecorderPanel } from "./recorder-panel";
import { RecordingsList } from "./recordings-list";

export function RecordPage() {
  const tr = useT();
  return (
    <div>
      <BackToPractice />
      <PageHeader
        eyebrow={tr("nav./practice")}
        title={tr("tool.record")}
        description={tr("ui.play_or_sing_then_listen_back_hearing_yourself_i")}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader icon={<Mic className="h-5 w-5" />} title={tr("ui.new_recording")} description={tr("ui.tip_put_the_phone_about_an_arm_s_length_from_you")} />
          <CardBody>
            <RecorderPanel />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("ui.your_recordings")} description={tr("ui.listen_at_0_75_to_catch_mistakes_recordings_neve")} />
          <CardBody>
            <RecordingsList />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
