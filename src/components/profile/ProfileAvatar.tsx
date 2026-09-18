function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const SIZES = {
  md: "h-16 w-16 text-lg",
  lg: "h-20 w-20 text-xl",
} as const;

/**
 * A student's photo, or their initials when there is none.
 *
 * Shared by the dashboard, which only shows it, and the profile page, which
 * is where it gets changed — so the two can never disagree about how a
 * missing photo looks.
 */
export function ProfileAvatar({
  studentName,
  photoUrl,
  size = "md",
}: {
  studentName: string;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-indigo-100 font-semibold text-indigo-800 shadow ring-1 ring-indigo-200 ${SIZES[size]}`}
    >
      {photoUrl ? (
        // Signed storage URLs are dynamic, so the native image element is
        // intentional here rather than a build-time configured host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={`${studentName}'s profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(studentName) || "S"}</span>
      )}
    </div>
  );
}
