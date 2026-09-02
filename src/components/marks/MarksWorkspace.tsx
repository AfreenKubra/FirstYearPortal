import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { MarksGrid } from "./MarksGrid";
import { getMarksGrid, listMarkableSubjects } from "@/lib/queries/marks";

/**
 * The staff marks workspace — one implementation, two audiences.
 *
 * Faculty and heads of department render this same component; the only
 * difference is `basePath`, exactly as the student directory does
 * (`queries/directory.ts`). Scoping is not a parameter here either: the
 * roster inside the grid comes from `student_directory`, so a mentor gets
 * their assignments and a HOD gets their department without either being
 * asked for.
 */
export async function MarksWorkspace({
  basePath,
  departmentCode,
  subjectId,
  section,
}: {
  basePath: string;
  departmentCode: string;
  subjectId?: string;
  section?: string;
}) {
  const subjects = await listMarkableSubjects(departmentCode);

  if (subjects.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Header />
        <Card>
          <CardBody>
            <EmptyState
              title="No subjects on file"
              description="Marks are recorded against the VTU scheme. An administrator needs to enter this department's subjects under Admin → VTU scheme before marks can be entered."
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const selectedId = subjectId ?? subjects[0].id;
  const selected = subjects.find((s) => s.id === selectedId) ?? subjects[0];
  const grid = await getMarksGrid(selected.id, section ?? null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header />

      {/* A GET form, so the chosen subject lands in the URL and the view is
          linkable — the same rule the student directory's filters follow. */}
      <Card as="section">
        <CardHeader title="Choose a subject" />
        <CardBody>
          <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-ink">Subject</span>
              <select
                name="subject"
                defaultValue={selected.id}
                className="h-11 min-w-[18rem] rounded-lg border border-indigo-200 bg-white px-3.5 text-sm text-ink shadow-sm hover:border-indigo-300 focus:border-indigo-500"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    Sem {subject.semester} · {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-ink">
                Section <span className="text-ink-faint">(optional)</span>
              </span>
              <input
                type="text"
                name="section"
                defaultValue={section ?? ""}
                placeholder="All"
                maxLength={4}
                className="h-11 w-24 rounded-lg border border-indigo-200 bg-white px-3.5 text-sm text-ink shadow-sm hover:border-indigo-300 focus:border-indigo-500"
              />
            </label>

            <button
              type="submit"
              className="h-11 rounded-lg bg-indigo-800 px-5 text-sm font-medium text-parchment shadow-sm hover:bg-indigo-700"
            >
              Show class
            </button>
          </form>
        </CardBody>
      </Card>

      {grid ? (
        <MarksGrid
          subjectId={selected.id}
          subjectLabel={`${selected.code} — ${selected.name}`}
          grid={grid}
        />
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              title="Subject not found"
              description="It may have been retired since this page was opened."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-2xl text-indigo-950 sm:text-3xl">Internal marks</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Record IA, assignment, and activity marks against the VTU scheme
        subjects. Nothing reaches a student until you release that component.
      </p>
    </header>
  );
}
