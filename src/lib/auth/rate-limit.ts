import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Rate limiting for the authentication endpoints (migration 0029).
 *
 * Called with the service role rather than the caller's session, so the
 * limiter is not itself reachable from a browser. Were it callable by anyone,
 * an attacker could burn a chosen address's allowance and lock a specific
 * student out — a denial of service dressed up as a defence.
 *
 * Every limit is applied twice: once per subject (the email typed) and once
 * per source address. Either alone is trivially avoided — an attacker with
 * one address rotates emails, an attacker with a botnet rotates addresses —
 * and the pair covers both without either being strict enough to inconvenience
 * a real person.
 */

export const AUTH_LIMITS = {
  /**
   * Sign-in. Ten in fifteen minutes is far more than a person who has simply
   * forgotten which password they used, and far fewer than a guessing run is
   * worth. The bucket is cleared on success, so a few fumbled attempts
   * followed by the right one cost nothing.
   */
  login: { perSubject: { limit: 10, windowSeconds: 900 }, perIp: { limit: 40, windowSeconds: 900 } },

  /**
   * Password reset. Tighter, because each attempt sends an email: an
   * unmetered endpoint here is a way to flood somebody's inbox using the
   * college's own domain as the sender.
   */
  passwordReset: { perSubject: { limit: 4, windowSeconds: 3600 }, perIp: { limit: 15, windowSeconds: 3600 } },

  /** Registration, per source only — there is no prior subject to key on. */
  register: { perSubject: { limit: 6, windowSeconds: 3600 }, perIp: { limit: 15, windowSeconds: 3600 } },
} as const;

export type AuthAction = keyof typeof AUTH_LIMITS;

/** Buckets hold a hash, never the address itself — see migration 0029. */
function bucketFor(action: string, kind: string, subject: string): string {
  const digest = createHash("sha256")
    .update(`${kind}:${subject.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  return `${action}:${kind}:${digest}`;
}

/**
 * The caller's address, as far as it can be known.
 *
 * `x-forwarded-for` is a client-supplied header everywhere except behind a
 * proxy that overwrites it — which Vercel does, and which local development
 * does not. Taking the first entry is right on Vercel; treating it as
 * authoritative anywhere else would let a caller spoof a fresh identity per
 * request. That is why the per-subject limit exists alongside this one rather
 * than the IP limit being trusted on its own.
 */
function callerIp(): string {
  const store = headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return store.get("x-real-ip") ?? "unknown";
}

export type RateLimitVerdict = {
  allowed: boolean;
  /** Buckets to clear once the attempt turns out to be legitimate. */
  buckets: string[];
};

/**
 * Records an attempt against both buckets and reports whether to proceed.
 *
 * Both are consumed even when the first already refuses, so a caller cannot
 * discover which limit they hit by watching which one stops counting — and so
 * an attacker rotating emails still accumulates against their address.
 *
 * Fails **open** if the limiter itself errors. A database hiccup must not
 * lock the whole institution out of signing in; the failure that matters here
 * is a brute-force run, and one that coincides with the limiter being down is
 * a narrower risk than every student being unable to log in.
 */
export async function consumeAuthAttempt(
  action: AuthAction,
  subject: string,
): Promise<RateLimitVerdict> {
  const rules = AUTH_LIMITS[action];
  const buckets = [
    { bucket: bucketFor(action, "subject", subject), rule: rules.perSubject },
    { bucket: bucketFor(action, "ip", callerIp()), rule: rules.perIp },
  ];

  try {
    const service = createAdminClient();
    const verdicts = await Promise.all(
      buckets.map(({ bucket, rule }) =>
        service.rpc("consume_rate_limit", {
          p_bucket: bucket,
          p_limit: rule.limit,
          p_window_seconds: rule.windowSeconds,
        }),
      ),
    );

    return {
      allowed: verdicts.every((v) => v.error !== null || v.data !== false),
      buckets: buckets.map((b) => b.bucket),
    };
  } catch {
    return { allowed: true, buckets: buckets.map((b) => b.bucket) };
  }
}

/** Forgets the buckets, once an attempt has proved itself legitimate. */
export async function clearAuthAttempt(buckets: string[]): Promise<void> {
  try {
    const service = createAdminClient();
    await Promise.all(
      buckets.map((bucket) =>
        service.rpc("clear_rate_limit", { p_bucket: bucket }),
      ),
    );
  } catch {
    // A bucket that fails to clear expires on its own within the window.
  }
}

/**
 * What a refused caller is told.
 *
 * Deliberately identical whether or not the address is registered, and
 * whether the subject or the source limit was the one hit — the login and
 * reset flows are careful not to confirm which addresses exist, and a
 * distinctive rate-limit message would undo that.
 */
export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a few minutes and try again.";
