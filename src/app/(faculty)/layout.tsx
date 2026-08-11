import { redirect } from "next/navigation";
import { StudentNav, type NavItem } from "@/components/layout/StudentNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getOwnFaculty } from "@/lib/queries/faculty";

/**
 * Shell for the faculty area. Mirrors the student shell (ARCHITECTURE 7) —
 * the route group `(faculty)` only attaches this layout, it does not change
 * URLs.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/faculty", label: "Dashboard" },
  { href: "/faculty/students", label: "My students" },
  { href: "#", label: "Achievements to verify", disabled: true },
  { href: "#", label: "Assessments", disabled: true },
  { href: "#", label: "Events", disabled: true },
  { href: "#", label: "Roadmap reviews", disabled: true },
];

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already confirmed role and status; this is the layout's own
  // check and the source of the faculty record the shell renders.
  const faculty = await getOwnFaculty();
  if (!faculty) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StudentNav items={NAV_ITEMS} studentName={faculty.fullName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-between border-b border-indigo-100 bg-white px-8 py-3 lg:flex">
          <p className="text-sm text-ink-faint">
            {faculty.designation} · {faculty.departmentCode} ·{" "}
            {faculty.employeeCode}
          </p>
          <LogoutButton />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
