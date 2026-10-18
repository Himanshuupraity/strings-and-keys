"use client";

import type { ReactNode } from "react";
import { PageHeader } from "./index";
import { useT, type MessageKey } from "@/lib/i18n";

/**
 * PageHeader whose eyebrow/title come from the i18n dictionary — for server-rendered pages that
 * can't call useT() themselves. Pass `descriptionKey` for a translated description (or `description` as-is).
 */
export function TPageHeader({ eyebrowKey, titleKey, descriptionKey, description, actions }: { eyebrowKey?: MessageKey; titleKey: MessageKey; descriptionKey?: MessageKey; description?: ReactNode; actions?: ReactNode }) {
  const t = useT();
  return <PageHeader eyebrow={eyebrowKey ? t(eyebrowKey) : undefined} title={t(titleKey)} description={descriptionKey ? t(descriptionKey) : description} actions={actions} />;
}
