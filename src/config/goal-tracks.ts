/**
 * What each career goal's track actually looks like.
 *
 * The roadmap used to show an exam countdown or nothing at all, which left
 * seven of the eight goals with a dead end reading "no exam track" — true,
 * but useless to a student whose goal was never about an exam. A goal that
 * leads to employment needs skills and internships; one that leads to
 * research needs higher-study routes; a startup needs a path from idea to
 * MVP. This file says which shape each goal takes and what belongs in it.
 *
 * Two rules, both carried over from the rest of the portal:
 *
 *   - **Every URL here was fetched and returned 200.** They are official
 *     sources — the examining body, the ministry, the test owner — not
 *     coaching sites or aggregators, because a portal that sends a student
 *     somewhere unofficial for an exam deadline is worse than one that sends
 *     them nowhere.
 *   - **No dates, fees, cut-offs, or eligibility rules.** Those change every
 *     cycle, and a stale one here would be read as authoritative. The exam
 *     name and its official page are stated; the student reads the specifics
 *     from the source. Dated exams still come from the admin-curated
 *     `resources` catalogue, where a person maintains them.
 *
 * Keyed by the exact `career_goals.name` seeded in `0001_init_mvp.sql`.
 */

export type TrackShape =
  | "exam"
  | "employment"
  | "research"
  | "startup"
  | "abroad"
  | "civil"
  | "core";

export type OfficialLink = {
  label: string;
  url: string;
  /** What a student will actually find there. */
  note: string;
};

export type GoalTrack = {
  /** Exact `career_goals.name`. */
  goalName: string;
  shape: TrackShape;
  /** One line naming what this track is for. */
  summary: string;
  /** Section heading, phrased as the student would describe it. */
  heading: string;
  /**
   * Exams worth knowing about, by name only. No dates or eligibility — the
   * official page owns those.
   */
  exams: OfficialLink[];
  /** Where to go for the authoritative version of anything here. */
  officialLinks: OfficialLink[];
  /** The concrete things this goal asks a student to build or do. */
  focus: string[];
};

const GATE_LINK: OfficialLink = {
  label: "GATE",
  url: "https://gate2026.iitg.ac.in/",
  note: "Organising institute's official site — dates, syllabus, and registration",
};

const UPSC_LINK: OfficialLink = {
  label: "UPSC",
  url: "https://www.upsc.gov.in/",
  note: "Notifications, syllabus, and previous papers",
};

const NCS_LINK: OfficialLink = {
  label: "National Career Service",
  url: "https://www.ncs.gov.in/",
  note: "Government job and internship listings",
};

const NPTEL_LINK: OfficialLink = {
  label: "NPTEL",
  url: "https://nptel.ac.in/",
  note: "Free courses and certification exams from the IITs and IISc",
};

const SWAYAM_LINK: OfficialLink = {
  label: "SWAYAM",
  url: "https://swayam.gov.in/",
  note: "Free courses from Indian universities",
};

export const GOAL_TRACKS: GoalTrack[] = [
  {
    goalName: "GATE / Higher studies in India",
    shape: "exam",
    heading: "Your GATE track",
    summary:
      "A dated exam to work backwards from, plus the preparation that fits around it.",
    exams: [GATE_LINK],
    officialLinks: [GATE_LINK, NPTEL_LINK, SWAYAM_LINK],
    focus: [
      "Identify which GATE paper matches your branch",
      "Strengthen engineering mathematics",
      "Work through previous years' question papers",
      "Sit full-length mock tests under timed conditions",
    ],
  },
  {
    goalName: "Government / PSU services",
    shape: "exam",
    heading: "Your government & PSU track",
    summary:
      "Most technical government and PSU recruitment runs through a written exam — several of them accept a GATE score.",
    exams: [
      GATE_LINK,
      {
        label: "UPSC Engineering Services (ESE)",
        url: "https://www.upsc.gov.in/",
        note: "Notification, syllabus, and previous papers",
      },
      {
        label: "SSC Junior Engineer",
        url: "https://ssc.gov.in/",
        note: "Staff Selection Commission notices and results",
      },
      {
        label: "Railway technical recruitment",
        url: "https://www.rrbapply.gov.in/",
        note: "Railway Recruitment Board's official application portal",
      },
    ],
    officialLinks: [
      NCS_LINK,
      {
        label: "India.gov.in",
        url: "https://www.india.gov.in/",
        note: "National portal — departments and recruitment notices",
      },
      {
        label: "ISRO",
        url: "https://www.isro.gov.in/",
        note: "Careers and recruitment notices",
      },
      {
        label: "DRDO",
        url: "https://www.drdo.gov.in/",
        note: "Careers and recruitment notices",
      },
    ],
    focus: [
      "Core engineering fundamentals for your branch",
      "Quantitative aptitude and reasoning",
      "Previous-year papers for the exams you are targeting",
      "Check each organisation's own recruitment page for openings",
    ],
  },
  {
    goalName: "IT / Software employment",
    shape: "employment",
    heading: "Your skills-to-employment track",
    summary:
      "This one is not an exam. Hiring here looks at what you can build, what you can solve, and what you have shipped.",
    exams: [],
    officialLinks: [NPTEL_LINK, SWAYAM_LINK, NCS_LINK],
    focus: [
      "Data structures and algorithms, practised regularly",
      "One language you know deeply, plus Git",
      "Two or three portfolio projects you can talk through",
      "An internship application in flight",
      "Aptitude and technical interview practice",
    ],
  },
  {
    goalName: "Research & Academia",
    shape: "research",
    heading: "Your research & higher-study track",
    summary:
      "Built around getting into a research programme — MTech, MS, or a direct PhD — and being useful once you are there.",
    exams: [GATE_LINK],
    officialLinks: [
      {
        label: "UGC",
        url: "https://www.ugc.gov.in/",
        note: "Regulations, fellowships, and recognised programmes",
      },
      NPTEL_LINK,
      SWAYAM_LINK,
    ],
    focus: [
      "Strong fundamentals in your chosen area",
      "Read papers in your field regularly",
      "Research methodology and literature review",
      "A research project or research internship",
      "Approach faculty about their ongoing projects",
    ],
  },
  {
    goalName: "Study abroad (MS / MEng)",
    shape: "abroad",
    heading: "Your study-abroad track",
    summary:
      "A multi-year sequence: keep the CGPA up, build evidence, then test scores and applications in the final year.",
    exams: [
      {
        label: "IELTS",
        url: "https://www.ielts.org/",
        note: "Test format, booking, and preparation material",
      },
      {
        label: "TOEFL",
        url: "https://www.ets.org/toefl.html",
        note: "Test format, booking, and preparation material",
      },
      {
        label: "GRE",
        url: "https://www.ets.org/gre.html",
        note: "Required by some programmes — check each university",
      },
    ],
    officialLinks: [
      {
        label: "UGC",
        url: "https://www.ugc.gov.in/",
        note: "Recognition and equivalence of Indian qualifications",
      },
    ],
    focus: [
      "Maintain a strong CGPA — it is the one thing you cannot fix later",
      "Technical projects and, if you can, research experience",
      "English test preparation (IELTS or TOEFL)",
      "Shortlist universities from their own official sites",
      "Statement of purpose, and ask for recommendation letters early",
    ],
  },
  {
    goalName: "Entrepreneurship / Startup",
    shape: "startup",
    heading: "Your startup track",
    summary:
      "A path from a problem worth solving to something real people use: idea, validation, MVP, first users.",
    exams: [],
    officialLinks: [
      {
        label: "Startup India",
        url: "https://www.startupindia.gov.in/",
        note: "Recognition, schemes, incubators, and funding programmes",
      },
      {
        label: "AICTE",
        url: "https://www.aicte-india.org/",
        note: "Student innovation and entrepreneurship schemes",
      },
    ],
    focus: [
      "Identify a problem you have actually seen someone have",
      "Talk to potential users before building anything",
      "Design thinking and a business model sketch",
      "Build a minimum viable product",
      "Hackathons, innovation competitions, and your college's incubation cell",
    ],
  },
  {
    goalName: "Civil services",
    shape: "civil",
    heading: "Your civil services track",
    summary:
      "A long preparation, which is why starting in first year is an advantage rather than early.",
    exams: [
      {
        label: "UPSC Civil Services Examination",
        url: "https://www.upsc.gov.in/",
        note: "Notification, syllabus, and previous papers",
      },
    ],
    officialLinks: [UPSC_LINK],
    focus: [
      "Build a daily reading habit — a newspaper, consistently",
      "NCERT foundation across the general studies subjects",
      "Current affairs, followed rather than crammed",
      "Answer writing practice",
      "Communication and public speaking",
    ],
  },
  {
    goalName: "Core (non-IT) engineering employment",
    shape: "core",
    heading: "Your core engineering track",
    summary:
      "Employment in your own branch, where the industry tools and your project work matter more than a general aptitude score.",
    exams: [GATE_LINK],
    officialLinks: [NCS_LINK, NPTEL_LINK, SWAYAM_LINK],
    focus: [
      "Core subjects of your branch, properly understood",
      "The software your industry actually uses",
      "Technical projects that show applied skill",
      "An industry certification where one is recognised",
      "Internships with companies in your sector",
    ],
  },
];

const BY_GOAL = new Map(GOAL_TRACKS.map((t) => [t.goalName, t]));

export function goalTrackFor(goalName: string): GoalTrack | null {
  return BY_GOAL.get(goalName) ?? null;
}
