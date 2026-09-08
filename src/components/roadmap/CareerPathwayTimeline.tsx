"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Tag } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { idleState, type ActionState } from "@/lib/actions/form-state";
import { useActionState } from "@/lib/actions/use-action-state";
import { setPrimaryDomain, setPrimaryGoal } from "@/lib/actions/pathway";
import {
  resourcesForStage,
  type Pathway,
  type PathwayItem,
  type SelectionOption,
} from "@/lib/roadmap/pathway";
import { costLabel, resourceKindLabel } from "@/config/resources";
import type { Resource } from "@/lib/queries/resources";
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
  const [state, formAction] = useActionState(action, idleState);

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
 * percentage that nobody had verified — a claim about the student derived
 * purely from their own say-so.
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
 * The curated study material and tests for one stage.
 *
 * Everything here is a real catalogue entry an administrator added and tagged
 * — nothing is generated, and nothing appears until somebody curates it. That
 * is why the empty state names the gap rather than staying silent: a student
 * seeing nothing should know it means "nobody has added material for this
 * yet", not "there is nothing worth studying".
 *
 * Cost carries its three states and the checked badge travels with each
 * entry, exactly as on the course shelf below — a student is being asked to
 * spend time and possibly money on these links.
 */
function StageMaterial({
  resources,
  domainName,
}: {
  resources: Resource[];
  domainName: string;
}) {
  if (resources.length === 0) {
    return (
      <p className="border-t border-indigo-100/70 pt-3 text-xs leading-relaxed text-ink-faint">
        No study material has been added for this stage of {domainName} yet.
        Worth asking your mentor — the portal only shows what somebody has
        deliberately curated.
      </p>
    );
  }

  return (
    <div className="border-t border-indigo-100/70 pt-3">
      <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-brass-700">
        Study material &amp; tests
      </p>
      <ul className="space-y-1.5">
        {resources.map((resource) => {
          const cost = costLabel(resource.isFree);
          return (
            <li key={resource.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-700 hover:underline"
              >
                {resource.title} ↗
              </a>
              <span className="text-xs text-ink-faint">
                {resourceKindLabel(resource.kind)}
                {resource.provider ? ` · ${resource.provider}` : ""} · {cost.label}
                {resource.isVerified ? "" : " · not checked"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
  resources,
  semester,
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
  /** The catalogue, for the per-stage study material. */
  resources: Resource[];
  semester: number | null;
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

                  {isOpen && (
                    <div className="ml-11 mt-1 space-y-3 rounded-lg border border-indigo-100 bg-parchment-sunk/40 px-3.5 py-3">
                      {stage.items.length > 0 && (
                        <ul className="divide-y divide-indigo-100/70">
                          {stage.items.map((item) => (
                            <StageItem key={item.id} item={item} />
                          ))}
                        </ul>
                      )}

                      <StageMaterial
                        resources={resourcesForStage(resources, stage.id, {
                          goalId: primaryGoal.id,
                          domainId: primaryDomain.id,
                        })}
                        domainName={primaryDomain.name}
                      />
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

    </div>
  );
}
