"use client";

import { useSyncExternalStore } from "react";
import { getSyncStatus, loadLearner, subscribeLearner, type ActiveLearner, type SyncStatus } from "@/lib/learner/store";

const SERVER_STATUS: SyncStatus = { state: "local-only", lastSyncedAt: null };

/** The learner on this device (null until they've entered a name) and the cloud sync status. */
export function useLearner(): { learner: ActiveLearner | null; status: SyncStatus } {
  const learner = useSyncExternalStore(subscribeLearner, loadLearner, () => null);
  const status = useSyncExternalStore(subscribeLearner, getSyncStatus, () => SERVER_STATUS);
  return { learner, status };
}
