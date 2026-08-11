import { redirect } from "next/navigation";
import { StudentNav, type NavItem } from "@/components/layout/StudentNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getOwnAdmin } from "@/lib/queries/admin";

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/accounts", label: "Account approvals" },
  { href: "/admin/assignments", label: "Faculty assignments" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware has already checked role and status. This is the layout's own
  // independent check — and it fails closed if the admins row is missing,
  // which is the state a user promoted in the DB but never given an admin
  // profile would be in.
  const admin = await getOwnAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StudentNav items={NAV_ITEMS} studentName={admin.fullName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-between border-b border-indigo-100 bg-white px-8 py-3 lg:flex">
          <p className="text-sm text-ink-faint">
            {admin.designation} · {admin.employeeCode}
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
