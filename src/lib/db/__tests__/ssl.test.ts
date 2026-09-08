import { describe, expect, it } from "vitest";
import { pgSslFor } from "../ssl";

describe("pgSslFor", () => {
  it("requires TLS for a hosted database", () => {
    expect(
      pgSslFor("postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("disables TLS for a local one", () => {
    // The Supabase CLI stack in CI has no TLS listener, and `pg` treats the
    // ssl option as a demand — so asking for it fails the connection before
    // a single statement runs.
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]) {
      expect(
        pgSslFor(`postgresql://postgres:postgres@${host}:54322/postgres`),
        host,
      ).toBe(false);
    }
  });

  it("handles an IPv6 loopback literal", () => {
    expect(pgSslFor("postgresql://postgres:postgres@[::1]:54322/postgres")).toBe(false);
  });

  it("is not fooled by a remote host that merely contains 'localhost'", () => {
    expect(pgSslFor("postgresql://u:p@localhost.example.com:5432/db")).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("requires TLS when the string is missing or unparseable", () => {
    // Failing closed: an unknown string is far more likely to be a remote
    // URL, and silently dropping TLS on a production connection is the one
    // outcome worth ruling out.
    expect(pgSslFor(undefined)).toEqual({ rejectUnauthorized: false });
    expect(pgSslFor("not a url")).toEqual({ rejectUnauthorized: false });
  });
});
