import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings/settings-view";
import { AccountPanel } from "@/components/account/account-panel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <SettingsView
      accountPanel={
        <Suspense fallback={null}>
          <AccountPanel />
        </Suspense>
      }
    />
  );
}
