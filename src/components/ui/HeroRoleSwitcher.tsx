"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";

type Tab = "student" | "faculty" | "hod";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "student", label: "Student Portal" },
  { id: "faculty", label: "Faculty & Staff" },
  { id: "hod", label: "Head of Department" },
];

export function HeroRoleSwitcher() {
  const [activeTab, setActiveTab] = useState<Tab>("student");

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Role Toggle Tabs */}
      <div className="inline-flex max-w-fit flex-wrap items-center rounded-xl bg-indigo-900/5 p-1 ring-1 ring-inset ring-indigo-900/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-indigo-950 shadow-sm ring-1 ring-black/5"
                : "text-ink-muted hover:text-indigo-950"
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Dynamic CTAs */}
      {activeTab === "student" && (
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
      )}

      {activeTab === "faculty" && (
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
            Faculty accounts are verified by an administrator before activation.
          </p>
        </div>
      )}

      {activeTab === "hod" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/login/hod" size="lg">
              Head of Department sign in
            </ButtonLink>
            <ButtonLink href="/register/staff" variant="secondary" size="lg">
              Request HOD access
            </ButtonLink>
          </div>
          <p className="text-xs text-ink-faint">
            A separate entrance that accepts Head of Department accounts only.
            Register as a head of department, then an administrator activates
            the account and it covers your whole department.
          </p>
        </div>
      )}
    </div>
  );
}
