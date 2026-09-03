"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { Card, CardBody, CardHeader, StatTile, Tag } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { idleState, type ActionState } from "@/lib/actions/form-state";
import { setPrimaryDomain, setPrimaryGoal } from "@/lib/actions/pathway";
import type { Pathway, PathwayItem, SelectionOption } from "@/lib/roadmap/pathway";
import type { EvidenceEntry } from "@/lib/queries/pathway";
import type { LookupOption } from "@/lib/queries/student";

const STAGE_MUTED = "opacity-55";

/**
 * One of the two focus cards, with its own inline "Change" control.
 *
 * The radio list is the *full* set of goals (or domains) the college offers,
 * not just the ones already on the student's profile — picking something new
 * adds it as well as making it primary, which the hint below the list says
 * plainly. Nothing is ever removed here; the profile page stays the only
 * place a selection comes off.
 */
function FocusCard({
  emoji,
  label,
  allOptions,
  chosen,
  primaryId,
  action,
  fieldName,
  submitLabel,
}: {
  emoji: string;
  label: string;
  allOptions: LookupOption[];
  chosen: SelectionOption[];
  primaryId: number | null;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fieldName: "goalId" | "domainId";
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, idleState);

  // Close the editor once the change has actually saved, so the card returns
  // to showing the new selection rather than leaving the form hanging open.
  useEffect(() => {
    if (state.status === "success") setOpen(false);
  }, [state.status]);

  const chosenIds = new Set(chosen.map((c) => c.id));

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {emoji} {label}
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-xs font-medium text-indigo-800 hover:border-indigo-400"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {!open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing selected yet.</p>
          ) : (
            chosen.map((c) => (
              <Tag key={c.id}>
                {c.id === primaryId ? "⭐ " : ""}
                {c.name}
              </Tag>
            ))
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {allOptions.map((o) => (
              <label key={o.id} className="cursor-pointer">
                <input
                  type="radio"
                  name={fieldName}
                  value={o.id}
                  defaultChecked={o.id === primaryId}
                  className="peer sr-only"
                />
                <span className="inline-flex items-center rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 peer-checked:border-indigo-500 peer-checked:bg-indigo-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400">
                  {o.name}
                  {!chosenIds.has(o.id) && (
                    <span className="ml-1 text-ink-faint">+</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-faint">
            The timeline follows your ⭐ primary. Anything marked{" "}
            <span className="text-ink-muted">+</span> isn&apos;t on your profile
            yet — choosing it adds it too.
          </p>
          <SubmitButton size="sm">{submitLabel}</SubmitButton>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}

/**
 * One skill or activity in a stage — guidance only.
 *
 * There is no checkbox here on purpose. Ticking one used to feed a progress
 * percentage that nobody had verified; what a student has actually done is
 * shown in the evidence panel below, from records somebody else confirmed.
 */
function StageItem({ item }: { item: PathwayItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-ink">
        <span aria-hidden="true" className="text-ink-faint">
          •
        </span>
        {item.label}
      </span>
      {item.href && (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-indigo-700 hover:underline"
        >
          Start learning →
        </a>
      )}
    </li>
  );
}

/**
 * The semester-wise career pathway — a new section above the existing
 * AI/mentor-reviewed roadmap, not a replacement for it.
 *
 * Every item's link is either real (resolved through the same
 * `link-providers.ts` whitelist the AI generator uses) or absent — never a
 * placeholder. "Why this?" always names the student's own real goal/domain
 * selection, nothing else.
 */
export function CareerPathwayTimeline({
  goalOptions,
  domainOptions,
  allGoals,
  allDomains,
  primaryGoal,
  primaryDomain,
  secondaryDomainNames,
  pathway,
  evidence,
  semester,
  courseCount,
  certificationCount,
  workshopCount,
}: {
  /** The student's own selections, with which one is primary. */
  goalOptions: SelectionOption[];
  domainOptions: SelectionOption[];
  /** Everything the college offers, for the "Change" pickers. */
  allGoals: LookupOption[];
  allDomains: LookupOption[];
  primaryGoal: SelectionOption | null;
  primaryDomain: SelectionOption | null;
  secondaryDomainNames: string[];
  pathway: Pathway;
  evidence: EvidenceEntry[];
  semester: number | null;
  courseCount: number;
  certificationCount: number;
  workshopCount: number;
}) {
  const [openStage, setOpenStage] = useState<string | null>(
    pathway.currentStageId ?? pathway.stages[0]?.id ?? null,
  );

  if (!primaryGoal || !primaryDomain) return null;

  const nextBestAction = pathway.nextBestAction;

  return (
    <div className="space-y-6">
      <Card as="section">
        <CardHeader
          title="My Personalized Roadmap"
          description="Your engineering journey, personalized around your career goal and technical interests."
        />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FocusCard
              emoji="🎯"
              label="Career goal"
              allOptions={allGoals}
              chosen={goalOptions}
              primaryId={primaryGoal.id}
              action={setPrimaryGoal}
              fieldName="goalId"
              submitLabel="Save career goal"
            />
            <FocusCard
              emoji="💻"
              label="Technical domain"
              allOptions={allDomains}
              chosen={domainOptions}
              primaryId={primaryDomain.id}
              action={setPrimaryDomain}
              fieldName="domainId"
              submitLabel="Save technical domain"
            />
          </div>

          <p className="text-sm text-ink-muted">
            {semester !== null ? (
              <>
                You are in <span className="font-medium text-indigo-950">semester {semester}</span>,
                which puts you in the stage marked below. This map is guidance — it makes no claim
                about what you have done.
              </>
            ) : (
              <>
                Your semester isn&apos;t on file, so no stage is marked as yours. Add it to your
                academic profile and the map will show where you are.
              </>
            )}
          </p>
        </CardBody>
      </Card>

      {nextBestAction && (
        <Card as="section" className="border-brass-300 bg-brass-50/40">
          <CardBody className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
              🚀 Next best action
            </p>
            <p className="text-base text-indigo-950">{nextBestAction.item.label}</p>
            <p className="text-sm text-ink-muted">{nextBestAction.reason}</p>
            {nextBestAction.item.href && (
              <a href={nextBestAction.item.href} target="_blank" rel="noopener noreferrer">
                <Button className="mt-1" size="sm" type="button">
                  Start learning →
                </Button>
              </a>
            )}
          </CardBody>
        </Card>
      )}

      <Card as="section">
        <CardHeader
          title="My Engineering Journey"
          description={`${primaryGoal.name} · ${primaryDomain.name}${secondaryDomainNames.length > 0 ? ` · also exploring ${secondaryDomainNames.join(", ")}` : ""}`}
        />
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3">
            {pathway.stages.map((stage) => {
              const isOpen = openStage === stage.id;

              return (
                <div key={stage.id}>
                  <button
                    type="button"
                    onClick={() => setOpenStage(isOpen ? null : stage.id)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      stage.position === "current"
                        ? "border-brass-400 bg-brass-50/50"
                        : stage.position === "past"
                          ? "border-indigo-100 bg-white"
                          : stage.position === "future"
                            ? `border-indigo-100 bg-white ${STAGE_MUTED}`
                            : "border-indigo-100 bg-white",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                        stage.position === "current"
                          ? "bg-brass-500 text-white"
                          : "bg-indigo-100 text-indigo-700",
                      ].join(" ")}
                    >
                      ●
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-indigo-950">
                        {stage.semesters} — {stage.label}
                        {stage.position === "current" && (
                          <span className="ml-2 rounded-full bg-brass-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            You are here
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {stage.items.length} things to focus on
                        {stage.position === "past" ? " · earlier in your degree" : ""}
                        {stage.position === "future" ? " · still ahead" : ""}
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-ink-faint">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {isOpen && stage.items.length > 0 && (
                    <div className="ml-11 mt-1 rounded-lg border border-indigo-100 bg-parchment-sunk/40 px-3.5 py-3">
                      <ul className="divide-y divide-indigo-100/70">
                        {stage.items.map((item) => (
                          <StageItem key={item.id} item={item} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 rounded-lg border border-dashed border-indigo-200 px-4 py-3">
              <span aria-hidden="true" className="text-lg">🏁</span>
              <div>
                <p className="text-sm font-medium text-indigo-950">Career goal</p>
                <p className="text-xs text-ink-faint">{primaryGoal.name}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="What's on your record"
          description="Only things somebody other than you has confirmed. Nothing here can be ticked off by hand."
        />
        <CardBody>
          <ul className="divide-y divide-indigo-100">
            {evidence.map((entry) => (
              <li
                key={entry.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
              >
                <span className="text-sm text-ink">{entry.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-base tabular-nums text-indigo-950">
                    {entry.value}
                  </span>
                  <span className="text-xs text-ink-faint">{entry.source}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            A zero here means nothing has been recorded yet — not that you have done nothing.
            Self-reported test scores are deliberately left out; they appear on{" "}
            <Link href="/assessments" className="text-indigo-700 hover:underline">
              your assessments page
            </Link>{" "}
            with their own unverified label.
          </p>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Recommended for your journey"
          description={`Real catalogue entries and events tagged to ${primaryDomain.name}.`}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="#domain-shelf">
              <StatTile label="📚 Courses" value={String(courseCount)} hint="See below" />
            </Link>
            <Link href="#domain-shelf">
              <StatTile label="📜 Certifications" value={String(certificationCount)} hint="See below" />
            </Link>
            <Link href="/events">
              <StatTile label="🎤 Workshops & events" value={String(workshopCount)} hint="See /events" />
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
