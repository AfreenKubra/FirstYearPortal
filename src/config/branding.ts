/**
 * Institution configuration. Everything here is presentation/config, not
 * data — departments that students are *assigned* to live in the
 * `departments` table (PRD 5.6 requires them to be admin-configurable
 * without a deploy). This list exists only to seed that table and to render
 * the registration dropdown before the DB round-trip.
 */
export const branding = {
  institution: {
    name: "HKBK College of Engineering",
    shortName: "HKBK",
    city: "Bengaluru",
    affiliation: "Affiliated to Visvesvaraya Technological University (VTU)",
    // Placeholder — PRD section 9 lists the official logo file as an open
    // question with stakeholders. Rendered as a monogram until supplied.
    logoUrl: null as string | null,
  },
  product: {
    name: "First-Year Portal",
    tagline: "Student Development and Analytics",
  },
  // Real, monitored addresses. These are rendered as live mailto: links on
  // /pending-approval, /account-blocked, and /privacy — the pages someone
  // reaches when they are locked out or asking about their own data — so an
  // unmonitored placeholder here sends a stuck user into a void.
  contacts: {
    support: "hod.aiml@hkbk.edu.in",
    privacy: "hod.aiml@hkbk.edu.in",
  },
} as const;

/** Seed values for the `departments` table (see migration 0001). */
export const SEED_DEPARTMENTS = [
  { code: "AIML", name: "Artificial Intelligence & Machine Learning" },
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "MECH", name: "Mechanical Engineering" },
  { code: "ISE", name: "Information Science & Engineering" },
] as const;
