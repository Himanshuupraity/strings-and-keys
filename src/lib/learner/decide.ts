/**
 * Pure sync decisions (unit-tested). Rules:
 *  - Never lose data: when both sides changed, merge (keep this device's version of records that
 *    differ, add everything else from the server), then upload.
 *  - If only the server changed, take the server copy.
 *  - If only this device changed, upload.
 */
export type StartupAction = "nothing" | "push" | "replace-local" | "merge-then-push";

export function startupAction(input: { remoteHasData: boolean; remoteUpdatedAt: string; syncedAt: string | null; dirty: boolean; localHasData: boolean }): StartupAction {
  const { remoteHasData, remoteUpdatedAt, syncedAt, dirty, localHasData } = input;
  if (!remoteHasData) return localHasData || dirty ? "push" : "nothing";
  const remoteChanged = syncedAt === null || new Date(remoteUpdatedAt).getTime() > new Date(syncedAt).getTime();
  if (!remoteChanged) return dirty ? "push" : "nothing";
  if (syncedAt === null) return localHasData ? "merge-then-push" : "replace-local";
  return dirty ? "merge-then-push" : "replace-local";
}

/** What to do with this device's existing data when a learner is chosen. */
export function selectionAction(input: { sameLearner: boolean; hadLearnerBefore: boolean; remoteHasData: boolean }): "keep-local" | "replace-local" | "clear-local" {
  if (input.sameLearner) return "keep-local";
  if (input.remoteHasData) return "replace-local";
  // A brand-new (empty) profile: a first-time visitor keeps what they did before typing a name;
  // switching from someone else starts fresh.
  return input.hadLearnerBefore ? "clear-local" : "keep-local";
}
