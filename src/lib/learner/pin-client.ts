/**
 * Client side of the optional learner PIN. The PIN itself is only ever sent to our own server
 * (/api/learners/:id/unlock); what the device keeps is a token that stops working if the PIN changes.
 */
const KEY = (id: string) => `mm:learner-token:${id}`;

export function getToken(id: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}

export function setToken(id: string, token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY(id), token);
    else window.localStorage.removeItem(KEY(id));
  } catch {
    /* storage blocked: the PIN will be asked again next time */
  }
}

export function tokenHeader(id: string | null | undefined): Record<string, string> {
  const t = id ? getToken(id) : null;
  return t ? { "x-learner-token": t } : {};
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; attemptsLeft?: number; message: string }
  | { ok: false; reason: "locked"; retryAfter?: number; message: string }
  | { ok: false; reason: "unsupported" | "error"; message: string };

async function json(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function unlockLearner(id: string, pin: string): Promise<UnlockResult> {
  let res: Response;
  try {
    res = await fetch(`/api/learners/${id}/unlock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }), cache: "no-store" });
  } catch {
    return { ok: false, reason: "error", message: "You're offline — connect to unlock this profile." };
  }
  const body = await json(res);
  if (res.ok) {
    setToken(id, (body.token as string | null) ?? null);
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, reason: "locked", retryAfter: Number(body.retryAfter) || undefined, message: String(body.error ?? "Too many wrong PINs. Try again in a few minutes.") };
  if (res.status === 403) {
    const left = typeof body.attemptsLeft === "number" ? body.attemptsLeft : undefined;
    return { ok: false, reason: "wrong", attemptsLeft: left, message: `Wrong PIN.${left !== undefined ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""}` };
  }
  if (res.status === 501) return { ok: false, reason: "unsupported", message: String(body.error ?? "PINs aren't set up on the server yet.") };
  return { ok: false, reason: "error", message: String(body.error ?? "Couldn't check the PIN.") };
}

/** Set (newPin) or remove (null) the PIN. Uses this device's token, or the current PIN. */
export async function changePin(id: string, newPin: string | null, currentPin?: string): Promise<{ ok: true; hasPin: boolean } | { ok: false; message: string; needsCurrent?: boolean }> {
  let res: Response;
  try {
    res = await fetch(`/api/learners/${id}/pin`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...tokenHeader(id) },
      body: JSON.stringify({ newPin, ...(currentPin ? { currentPin } : {}) }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "You're offline — connect to change the PIN." };
  }
  const body = await json(res);
  if (res.ok) {
    setToken(id, (body.token as string | null) ?? null);
    return { ok: true, hasPin: !!body.hasPin };
  }
  return { ok: false, message: String(body.error ?? "Couldn't update the PIN."), needsCurrent: res.status === 401 };
}
