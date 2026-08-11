import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { RegisterForm } from "@/components/registration/RegisterForm";
import { getLookups } from "@/lib/queries/student";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  const { departments, languages } = await getLookups();

  return (
    <AuthShell
      title="Create your student account"
      subtitle="Three short steps. A portal administrator approves your account before you can sign in — everything you enter here is saved while you wait."
      aside={{
        heading: "Register once — the college stops asking for the same details on paper.",
        points: [
          "Your USN, department, and contact details are recorded once and reused everywhere.",
          "Guardian contact is visible only to you and your assigned mentor.",
          "You choose what you consent to, and that record is kept.",
        ],
      }}
      footer={
        <div className="space-y-1.5">
          <p>
            Already registered?{" "}
            <Link
              href="/login"
              className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              Sign in instead
            </Link>
          </p>
          <p className="text-xs text-ink-faint">
            Faculty or administrator?{" "}
            <Link
              href="/register/staff"
              className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              Request a staff account
            </Link>
          </p>
        </div>
      }
    >
      <RegisterForm departments={departments} languages={languages} />
    </AuthShell>
  );
}
