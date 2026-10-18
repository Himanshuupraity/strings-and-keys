"use client";

import { Mic } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { RecorderPanel } from "./recorder-panel";
import { RecordingsList } from "./recordings-list";

export function RecordPage() {
  return (
    <div>
      <BackToPractice />
      <PageHeader
        eyebrow="Practice toolkit"
        title="Record yourself"
        description="Play or sing, then listen back. Hearing yourself is one of the fastest ways to fix timing, buzzing strings and uneven notes."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader icon={<Mic className="h-5 w-5" />} title="New recording" description="Tip: put the phone about an arm's length from your instrument." />
          <CardBody>
            <RecorderPanel />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your recordings" description="Listen at 0.75× to catch mistakes. Recordings never leave this device unless you share them." />
          <CardBody>
            <RecordingsList />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
