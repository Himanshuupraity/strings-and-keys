"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CloudDownload, CloudUpload, HardDrive, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, Segmented, Skeleton } from "@/components/ui";
import { applyImport, exportAll, planImport, type ImportPlan } from "@/lib/storage/repositories";
import { canonical } from "@/lib/server/db/sync-mapping";
import type { ExportBundle } from "@/lib/storage/schemas";

interface Me {
  enabled: boolean;
  google: boolean;
  user: { id: string; email: string; name: string | null; hasPassword: boolean; google: boolean } | null;
  error?: string;
}

interface ServerPlan {
  added: number;
  identical: number;
  conflicts: { collection: string; key: string }[];
}

type Pending =
  | { kind: "upload"; bundle: ExportBundle; plan: ServerPlan; rejected: number }
  | { kind: "download"; bundle: ExportBundle; plan: ImportPlan };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * The server stores JSON in Postgres jsonb, which may reorder object keys. Before comparing a
 * downloaded bundle with this device, swap in the local value wherever the two are equal so the
 * dry run reports them as identical rather than as false conflicts.
 */
function alignWithLocal(remote: ExportBundle, local: ExportBundle): ExportBundle {
  const collections: ExportBundle["collections"] = {};
  for (const [c, rows] of Object.entries(remote.collections)) {
    const mine = new Map((local.collections[c] ?? []).map((r) => [r.key, r.value]));
    collections[c] = rows.map((r) => {
      const l = mine.get(r.key);
      return l !== undefined && canonical(l) === canonical(r.value) ? { key: r.key, value: l } : r;
    });
  }
  return { ...remote, collections };
}

function PlanSummary({ added, identical, conflicts }: { added: number; identical: number; conflicts: number }) {
  return (
    <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
      <li><Badge tone="success">{added} new</Badge></li>
      <li><Badge tone="neutral">{identical} already the same</Badge></li>
      <li><Badge tone={conflicts ? "warn" : "neutral"}>{conflicts} different on both</Badge></li>
    </ul>
  );
}

/** Account & sync settings. In local-first mode it simply explains that progress lives on this device. */
export function AccountPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [importPrefs, setImportPrefs] = useState(false);

  const refresh = useCallback(
    () =>
      fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
        .then((res) => res.json() as Promise<Me>)
        .catch((): Me => ({ enabled: false, google: false, user: null }))
        .then(setMe),
    [],
  );

  useEffect(() => {
    void refresh();
    const status = new URLSearchParams(window.location.search).get("account");
    if (status === "google-ok") toast.success("Signed in with Google.");
    else if (status === "google-error") toast.error("Google sign-in didn't complete. Please try again.");
    else if (status === "google-unverified") toast.error("Your Google email isn't verified, so we couldn't sign you in.");
  }, [refresh]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy("auth");
    setFormError(null);
    const { res, data } = await postJson(`/api/auth/${mode}`, {
      email: form.get("email"),
      password: form.get("password"),
      ...(mode === "register" ? { name: form.get("name") || undefined } : {}),
    }).catch(() => ({ res: null, data: { error: "Network error — please try again." } }));
    setBusy(null);
    if (!res?.ok) {
      setFormError(data.error ?? "Something went wrong.");
      return;
    }
    toast.success(mode === "register" ? "Account created." : "Signed in.");
    await refresh();
  };

  const signOut = async () => {
    setBusy("logout");
    await postJson("/api/auth/logout", {}).catch(() => null);
    setBusy(null);
    setPending(null);
    toast.success("Signed out. Your progress on this device is untouched.");
    await refresh();
  };

  const startUpload = async () => {
    setBusy("upload");
    try {
      const bundle = await exportAll();
      const { res, data } = await postJson("/api/sync", { bundle, dryRun: true });
      if (!res.ok) throw new Error(data.error ?? "Upload check failed.");
      setPending({ kind: "upload", bundle, plan: data.plan, rejected: data.rejected?.length ?? 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload check failed.");
    } finally {
      setBusy(null);
    }
  };

  const confirmUpload = async (strategy: "keep-server" | "keep-uploaded") => {
    if (pending?.kind !== "upload") return;
    setBusy("confirm");
    const { res, data } = await postJson("/api/sync", { bundle: pending.bundle, strategy }).catch(() => ({ res: null, data: {} }));
    setBusy(null);
    if (!res?.ok) {
      toast.error(data.error ?? "Upload failed. Nothing was changed on this device.");
      return;
    }
    setPending(null);
    toast.success("This device's progress is saved to your account.");
  };

  const startDownload = async () => {
    setBusy("download");
    try {
      const res = await fetch("/api/sync", { credentials: "same-origin", cache: "no-store" });
      const remote = await res.json();
      if (!res.ok) throw new Error(remote.error ?? "Download failed.");
      const bundle = alignWithLocal(remote as ExportBundle, await exportAll());
      setPending({ kind: "download", bundle, plan: await planImport(bundle) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDownload = async (strategy: "keep-local" | "keep-imported") => {
    if (pending?.kind !== "download") return;
    setBusy("confirm");
    try {
      await applyImport(pending.bundle, strategy, importPrefs);
      setPending(null);
      toast.success("Progress from your account was added to this device.");
    } catch {
      toast.error("Couldn't apply the download. This device's data was not cleared.");
    } finally {
      setBusy(null);
    }
  };

  if (!me) {
    return (
      <Card>
        <CardBody className="space-y-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardBody>
      </Card>
    );
  }

  if (!me.enabled) {
    return (
      <Card data-testid="account-panel">
        <CardHeader icon={<HardDrive className="h-5 w-5" />} title="Your progress is saved on this device" description="No account needed. Lessons, practice history, drills and settings are stored in this browser." />
        <CardBody className="space-y-2 text-sm text-muted">
          <p>Clearing your browser data or switching browsers will start you fresh, so download a backup now and then.</p>
          <p>Cross-device sync is available when the app is run with a database (see docs/persistence.md).</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card data-testid="account-panel">
      <CardHeader
        icon={<UserRound className="h-5 w-5" />}
        title="Account & sync"
        description={me.user ? <>Signed in as <strong className="text-text">{me.user.email}</strong></> : "Optional: sign in to keep your progress in your account and use it on other devices."}
        action={me.user ? <Button variant="ghost" size="sm" onClick={signOut} loading={busy === "logout"}><LogOut className="h-4 w-4" /> Sign out</Button> : undefined}
      />
      <CardBody className="space-y-4">
        {me.error && <Callout tone="warn" title="Account server unavailable">{me.error}</Callout>}

        {!me.user ? (
          <div className="space-y-4">
            <Segmented label="Account action" value={mode} onChange={(m) => { setMode(m); setFormError(null); }} options={[{ value: "login", label: "Sign in" }, { value: "register", label: "Create account" }]} />
            <form onSubmit={submit} className="max-w-sm space-y-3">
              {mode === "register" && (
                <Field label="Name (optional)" htmlFor="acct-name">
                  <Input id="acct-name" name="name" autoComplete="name" maxLength={60} />
                </Field>
              )}
              <Field label="Email" htmlFor="acct-email">
                <Input id="acct-email" name="email" type="email" required autoComplete="email" />
              </Field>
              <Field label="Password" htmlFor="acct-password" hint={mode === "register" ? "At least 8 characters." : undefined}>
                <Input id="acct-password" name="password" type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} />
              </Field>
              {formError && <p className="text-sm text-danger" role="alert">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy === "auth"}>{mode === "register" ? "Create account" : "Sign in"}</Button>
                {me.google && (
                  <a href="/api/auth/google" className="inline-flex h-10 items-center justify-center rounded-xl border border-border-strong px-4 text-sm font-medium hover:bg-surface-2">Continue with Google</a>
                )}
              </div>
            </form>
            <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" /> Signing in never changes this device&apos;s progress. You choose when to upload or download.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={startUpload} loading={busy === "upload"} disabled={!!busy}><CloudUpload className="h-4 w-4" /> Upload this device&apos;s progress</Button>
              <Button variant="secondary" onClick={startDownload} loading={busy === "download"} disabled={!!busy}><CloudDownload className="h-4 w-4" /> Download from account</Button>
            </div>

            {pending?.kind === "upload" && (
              <Callout tone={pending.plan.conflicts.length ? "warn" : "info"} title="Before uploading — here's what would change in your account">
                <PlanSummary added={pending.plan.added} identical={pending.plan.identical} conflicts={pending.plan.conflicts.length} />
                {pending.rejected > 0 && <p className="mt-2">{pending.rejected} item(s) on this device couldn&apos;t be read and will be skipped.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {pending.plan.conflicts.length > 0 ? (
                    <>
                      <Button size="sm" onClick={() => confirmUpload("keep-uploaded")} loading={busy === "confirm"}>Upload — keep this device&apos;s version</Button>
                      <Button size="sm" variant="secondary" onClick={() => confirmUpload("keep-server")} disabled={!!busy}>Upload new items only — keep account&apos;s version</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => confirmUpload("keep-server")} loading={busy === "confirm"} disabled={pending.plan.added === 0}>{pending.plan.added ? "Upload" : "Nothing new to upload"}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                </div>
              </Callout>
            )}

            {pending?.kind === "download" && (
              <Callout tone={pending.plan.conflicts.length ? "warn" : "info"} title="Before downloading — here's what would change on this device">
                <PlanSummary added={pending.plan.added} identical={pending.plan.identical} conflicts={pending.plan.conflicts.length} />
                <label className="mt-3 flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={importPrefs} onChange={(e) => setImportPrefs(e.target.checked)} className="accent-[var(--accent)]" />
                  Also use the account&apos;s settings (theme, instrument mode, labels)
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pending.plan.conflicts.length > 0 ? (
                    <>
                      <Button size="sm" onClick={() => confirmDownload("keep-local")} loading={busy === "confirm"}>Add new items — keep this device&apos;s version</Button>
                      <Button size="sm" variant="secondary" onClick={() => confirmDownload("keep-imported")} disabled={!!busy}>Replace differing items with the account&apos;s version</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => confirmDownload("keep-local")} loading={busy === "confirm"} disabled={pending.plan.added === 0 && !importPrefs}>{pending.plan.added || importPrefs ? "Download" : "Already up to date"}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                </div>
              </Callout>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
