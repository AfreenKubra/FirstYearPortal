import { logout } from "@/lib/actions/auth";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={[
          "rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-indigo-50 hover:text-indigo-900",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        Sign out
      </button>
    </form>
  );
}
