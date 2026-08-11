import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  CreateDepartmentForm,
  ToggleDepartmentForm,
} from "@/components/admin/DepartmentForms";
import { getDepartmentsWithCounts } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Departments" };

export default async function AdminDepartmentsPage() {
  const departments = await getDepartmentsWithCounts();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">Departments</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Departments are data, not code — adding one here makes it available
          on the registration form immediately, with no deploy.
        </p>
      </header>

      <Card as="section">
        <CardHeader title="Add a department" />
        <CardBody>
          <CreateDepartmentForm />
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="All departments"
          description="Inactive departments stay on existing student records but disappear from new registrations."
        />
        <CardBody className="py-0">
          <ul className="divide-y divide-indigo-100">
            {departments.map((dept) => (
              <li
                key={dept.code}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-indigo-950">
                      {dept.code}
                    </span>
                    {!dept.is_active && (
                      <span className="rounded-md border border-ink-faint/30 bg-parchment-sunk px-2 py-0.5 text-xs font-medium text-ink-faint">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-muted">{dept.name}</p>
                  <p className="text-xs text-ink-faint">
                    {dept.studentCount} student
                    {dept.studentCount === 1 ? "" : "s"}
                  </p>
                </div>

                <ToggleDepartmentForm
                  code={dept.code}
                  isActive={dept.is_active}
                  studentCount={dept.studentCount}
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
