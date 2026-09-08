/**
 * Whether a Postgres connection should negotiate TLS.
 *
 * Every direct-Postgres caller in this repo hardcoded
 * `ssl: { rejectUnauthorized: false }`. That is right for Supabase's hosted
 * database, which requires TLS and presents a certificate this project does
 * not pin — and wrong for a local one, which has no TLS listener at all. The
 * `pg` client treats the option as a demand rather than a preference, so
 * against a local server it fails outright with "The server does not support
 * SSL connections" before running a single statement.
 *
 * That is exactly how CI failed the first time it ran: not on any migration,
 * but on the connection, having never reached one.
 *
 * Deciding from the host keeps one rule in one place. It deliberately does
 * not read an env var — a flag that disables TLS is a flag someone can set
 * against production by mistake, and the host already says everything needed.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

export type PgSslOption = false | { rejectUnauthorized: boolean };

export function pgSslFor(connectionString: string | undefined): PgSslOption {
  if (!connectionString) return { rejectUnauthorized: false };

  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    // An unparseable string is somebody else's error to report — but it is
    // far more likely to be a remote URL than a local one, so require TLS.
    return { rejectUnauthorized: false };
  }

  // URL keeps the brackets on an IPv6 literal.
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return LOCAL_HOSTS.has(host) ? false : { rejectUnauthorized: false };
}
