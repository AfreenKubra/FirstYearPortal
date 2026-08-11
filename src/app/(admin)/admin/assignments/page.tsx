import type { Metadata } from "next";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import {
  CreateAssignmentForm,
  DeleteAssignmentForm,
} from "@/components/admin/AssignmentForms";
import {
  getAssignments,
  getFacultyOptions,
} from "@/lib/queries/admin";
import { getLookups } from "@/lib/queries/student";
import { describeAssignment } from "@/lib/admin/analytics";

export const metadata: Metadata = { title: "Faculty assignments" };

export default async function AdminAssignmentsPage() {
  const [assignments, faculty, lookups] = await Promise.all([
    getAssignments(),
    getFacultyOptions(),
    getLookups(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">
          Faculty assignments
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Assignments are what give a faculty member sight of any student at
          all. Without one, their dashboard is empty — visibility is never
          granted by default.
        </p>
      </header>

      <Card as="section">
        <CardHeader title="Create an assignment" />
        <CardBody>
          <CreateAssignmentForm
            faculty={faculty}
            departments={lookups.departments}
          />
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Current assignments"
          description={`${assignments.length} in effect`}
        />
        <CardBody className={assignments.length === 0 ? undefined : "py-0"}>
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              description="Create one above to give a faculty member visibility of their students."
            />
          ) : (
            <ul className="divide-y divide-indigo-100">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-indigo-950">
                        {assignment.facultyName}
                      </p>
                      {assignment.isMentor && (
                        <span className="rounded-md border border-brass-300/60 bg-brass-50 px-2 py-0.5 text-xs font-medium text-brass-700">
                          Mentor
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {describeAssignment({
                        studentName: assignment.studentName,
                        departmentCode: assignment.departmentCode,
                        semester: assignment.semester,
                        section: assignment.section,
                        isMentor: assignment.isMentor,
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {assignment.facultyCode} · created{" "}
                      {new Date(assignment.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <DeleteAssignmentForm id={assignment.id} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
