"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";

export function HeroRoleSwitcher() {
  const [activeTab, setActiveTab] = useState<"student" | "faculty">("student");

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Role Toggle Tabs */}
      <div className="inline-flex max-w-fit items-center rounded-xl bg-indigo-900/5 p-1 ring-1 ring-inset ring-indigo-900/10">
        <button
          type="button"
          onClick={() => setActiveTab("student")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "student"
              ? "bg-white text-indigo-950 shadow-sm ring-1 ring-black/5"
              : "text-ink-muted hover:text-indigo-950"
          }`}
        >
          <span>Student Portal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("faculty")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "faculty"
              ? "bg-white text-indigo-950 shadow-sm ring-1 ring-black/5"
              : "text-ink-muted hover:text-indigo-950"
          }`}
        >
          <span>Faculty & Staff</span>
        </button>
      </div>

      {/* Dynamic CTAs */}
      {activeTab === "student" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/register" size="lg">
              Create your student account
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Student sign in
            </ButtonLink>
          </div>
          <p className="text-xs text-ink-faint">
            Open to all first-year HKBKCE students. A portal administrator
            approves your account before you can sign in.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/register/staff" size="lg">
              Create your faculty account
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Faculty sign in
            </ButtonLink>
          </div>
          <p className="text-xs text-ink-faint">
            Faculty and administrator accounts are verified by an administrator before activation.
          </p>
        </div>
      )}
    </div>
  );
}
