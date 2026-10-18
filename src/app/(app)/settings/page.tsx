import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { ProfileSyncPanel } from "@/components/learner/profile-panel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsView accountPanel={<ProfileSyncPanel />} />;
}
