"use client";

import type { ReactNode } from "react";
import { PageHeader } from "./index";
import { useT, type MessageKey } from "@/lib/i18n";

/**
 * PageHeader whose eyebrow/title come from the i18n dictionary — for server-rendered pages that
 * can't call useT() themselves. The description stays as given (English body text for now).
 */
export function TPageHeader({ eyebrowKey, titleKey, description, actions }: { eyebrowKey?: MessageKey; titleKey: MessageKey; description?: ReactNode; actions?: ReactNode }) {
  const t = useT();
  return <PageHeader eyebrow={eyebrowKey ? t(eyebrowKey) : undefined} title={t(titleKey)} description={description} actions={actions} />;
}
