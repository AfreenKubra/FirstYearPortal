/**
 * Curated content for the career pathway timeline (`/roadmap`'s new
 * semester-wise section).
 *
 * This is hand-authored, reviewed content — transcribed from the user's own
 * brief for this feature — not AI-generated and not invented on the fly. It
 * follows the exact discipline `generate.ts`'s `TRACKS` array already uses
 * for the AI/rule-based roadmap: real skill and activity *labels* (generic
 * topic names like "Python" or "Coding interviews," never a specific
 * project name, certification title, or company that would need to be
 * independently verified to be true). Where an item names a real learning
 * platform, it does so through `provider`/`keyword`, resolved by the
 * existing `link-providers.ts` whitelist — never a raw URL written here.
 *
 * Keyed by the exact `career_goals.name` / `technical_domains.name` strings
 * seeded in `0001_init_mvp.sql`, the same matching style `generate.ts` uses.
 */

import type { ProviderKey } from "@/lib/roadmap/link-providers";

export type PathwayStageId = "foundation" | "core" | "specialize" | "career_ready";

export const PATHWAY_STAGES: Array<{ id: PathwayStageId; label: string; semesters: string }> = [
  { id: "foundation", label: "Explore & Build Foundations", semesters: "Sem 1–2" },
  { id: "core", label: "Build Core Skills", semesters: "Sem 3–4" },
  { id: "specialize", label: "Apply & Specialize", semesters: "Sem 5–6" },
  { id: "career_ready", label: "Become Career Ready", semesters: "Sem 7–8" },
];

export type PathwayItemDef = {
  id: string;
  label: string;
  stage: PathwayStageId;
  provider?: ProviderKey;
  keyword?: string;
};

export type CareerTrack = {
  /** Exact `career_goals.name`. */
  goalName: string;
  items: PathwayItemDef[];
};

export type DomainPathway = {
  /** Exact `technical_domains.name`. */
  domainName: string;
  items: PathwayItemDef[];
};

function items(
  trackKey: string,
  rows: Array<[PathwayStageId, string, ProviderKey?, string?]>,
): PathwayItemDef[] {
  return rows.map(([stage, label, provider, keyword], i) => ({
    id: `${trackKey}:${stage}:${i}`,
    label,
    stage,
    provider,
    keyword,
  }));
}

// --- Career-goal layer (spec section 4) -------------------------------------

export const CAREER_TRACKS: CareerTrack[] = [
  {
    goalName: "IT / Software employment",
    items: items("goal-it-software", [
      ["foundation", "Programming fundamentals"],
      ["foundation", "Git / GitHub basics", "github_skills"],
      ["core", "Data structures & algorithms"],
      ["core", "Coding practice"],
      ["specialize", "Hackathons"],
      ["specialize", "GitHub portfolio", "github_skills"],
      ["specialize", "Internship applications"],
      ["career_ready", "Resume preparation"],
      ["career_ready", "Technical interviews"],
      ["career_ready", "Aptitude & placement preparation"],
    ]),
  },
  {
    goalName: "GATE / Higher studies in India",
    items: items("goal-gate", [
      ["foundation", "Strengthen engineering mathematics"],
      ["foundation", "Identify your GATE paper"],
      ["core", "Core subject preparation"],
      ["core", "NPTEL courses for your GATE paper", "nptel", "GATE preparation"],
      ["specialize", "Previous-year GATE questions"],
      ["specialize", "Mock tests"],
      ["career_ready", "GATE preparation milestones"],
      ["career_ready", "M.Tech / IIT / IISc application awareness"],
    ]),
  },
  {
    goalName: "Study abroad (MS / MEng)",
    items: items("goal-study-abroad", [
      ["foundation", "Maintain a strong CGPA"],
      ["foundation", "Technical projects"],
      ["core", "Research exposure"],
      ["core", "IELTS / TOEFL awareness"],
      ["specialize", "Internships"],
      ["specialize", "GRE awareness (where applicable)"],
      ["career_ready", "Shortlist research universities"],
      ["career_ready", "SOP preparation"],
      ["career_ready", "LOR planning"],
      ["career_ready", "Application timeline"],
    ]),
  },
  {
    goalName: "Entrepreneurship / Startup",
    items: items("goal-entrepreneurship", [
      ["foundation", "Problem identification"],
      ["foundation", "Design thinking"],
      ["core", "Product development basics"],
      ["core", "Business model basics"],
      ["specialize", "Prototype / MVP"],
      ["specialize", "Hackathons"],
      ["specialize", "Innovation competitions"],
      ["career_ready", "Startup ecosystem exposure"],
      ["career_ready", "Incubation programmes"],
      ["career_ready", "Pitch deck preparation"],
    ]),
  },
  {
    goalName: "Civil services",
    items: items("goal-civil-services", [
      ["foundation", "Communication skills"],
      ["foundation", "NCERT foundation"],
      ["core", "Current affairs"],
      ["core", "General studies foundation"],
      ["specialize", "Essay writing"],
      ["specialize", "Public speaking"],
      ["career_ready", "UPSC awareness"],
      ["career_ready", "Leadership activities"],
      ["career_ready", "Civil service examination pathway"],
    ]),
  },
  {
    goalName: "Government / PSU services",
    items: items("goal-govt-psu", [
      ["foundation", "Core engineering fundamentals"],
      ["foundation", "Aptitude"],
      ["core", "Reasoning"],
      ["core", "GATE awareness"],
      ["specialize", "Government examination awareness"],
      ["specialize", "PSU recruitment awareness"],
      ["career_ready", "Previous-year questions"],
      ["career_ready", "Mock examinations"],
    ]),
  },
  {
    goalName: "Research & Academia",
    items: items("goal-research", [
      ["foundation", "Strong fundamentals"],
      ["foundation", "Research methodology basics"],
      ["core", "Literature review"],
      ["core", "Reading technical papers"],
      ["specialize", "Research projects"],
      ["specialize", "Research internships"],
      ["career_ready", "Paper writing"],
      ["career_ready", "Conference participation"],
      ["career_ready", "Higher studies / PhD pathway awareness"],
    ]),
  },
  {
    goalName: "Core (non-IT) engineering employment",
    items: items("goal-core-engineering", [
      ["foundation", "Core engineering fundamentals"],
      ["foundation", "Branch-specific tools"],
      ["core", "Industry-standard software & tools"],
      ["core", "Technical projects"],
      ["specialize", "Industry certifications"],
      ["specialize", "Internships"],
      ["career_ready", "Technical aptitude"],
      ["career_ready", "Core-company interview preparation"],
    ]),
  },
];

// --- Technical-domain layer (spec section 5) --------------------------------

export const DOMAIN_PATHWAYS: DomainPathway[] = [
  {
    domainName: "Artificial Intelligence & ML",
    items: items("domain-ai-ml", [
      ["foundation", "Python", "nptel", "Python programming"],
      ["foundation", "Mathematics for ML"],
      ["core", "Data handling (NumPy / Pandas)"],
      ["core", "Machine learning fundamentals", "kaggle_learn"],
      ["specialize", "Deep learning", "ibm_skillsbuild"],
      ["specialize", "Computer vision / NLP"],
      ["career_ready", "AI projects portfolio"],
      ["career_ready", "Internship preparation", "google_developers"],
    ]),
  },
  {
    domainName: "Data Science & Analytics",
    items: items("domain-data-science", [
      ["foundation", "Python"],
      ["foundation", "Statistics"],
      ["core", "SQL"],
      ["core", "Data visualization", "kaggle_learn"],
      ["specialize", "Data analytics"],
      ["specialize", "Machine learning"],
      ["career_ready", "Portfolio of analyses"],
    ]),
  },
  {
    domainName: "Cybersecurity",
    items: items("domain-cybersecurity", [
      ["foundation", "Networking fundamentals", "cisco_netacad"],
      ["foundation", "Linux basics"],
      ["core", "Cybersecurity fundamentals", "cisco_netacad"],
      ["core", "Security tools"],
      ["specialize", "Security labs"],
      ["specialize", "Ethical hacking basics"],
      ["career_ready", "Security projects portfolio"],
    ]),
  },
  {
    domainName: "Cloud & DevOps",
    items: items("domain-cloud-devops", [
      ["foundation", "Linux basics"],
      ["foundation", "Networking fundamentals"],
      ["core", "Git"],
      ["core", "Cloud fundamentals", "aws_skill_builder"],
      ["specialize", "AWS / Azure", "microsoft_learn", "Azure fundamentals"],
      ["specialize", "Docker"],
      ["career_ready", "CI/CD"],
      ["career_ready", "Kubernetes"],
    ]),
  },
  {
    domainName: "Web Development",
    items: items("domain-web-dev", [
      ["foundation", "HTML & CSS"],
      ["foundation", "JavaScript"],
      ["core", "Git", "github_skills"],
      ["core", "A frontend framework"],
      ["specialize", "Backend development"],
      ["specialize", "Databases"],
      ["career_ready", "Full-stack projects portfolio", "infosys_springboard"],
    ]),
  },
  {
    domainName: "Mobile App Development",
    items: items("domain-mobile-dev", [
      ["foundation", "Programming fundamentals"],
      ["foundation", "UI fundamentals"],
      ["core", "Flutter / React Native / Android"],
      ["core", "Working with APIs"],
      ["specialize", "Databases for mobile"],
      ["career_ready", "Mobile projects portfolio"],
    ]),
  },
  {
    domainName: "Embedded Systems & IoT",
    items: items("domain-embedded-iot", [
      ["foundation", "C / C++", "nptel", "embedded C"],
      ["foundation", "Electronics basics"],
      ["core", "Microcontrollers"],
      ["core", "Sensors"],
      ["specialize", "Embedded programming"],
      ["specialize", "IoT fundamentals", "swayam", "internet of things"],
      ["career_ready", "IoT projects portfolio"],
    ]),
  },
  {
    domainName: "Networking",
    items: items("domain-networking", [
      ["foundation", "Networking fundamentals", "cisco_netacad"],
      ["foundation", "TCP/IP"],
      ["core", "Routing"],
      ["core", "Switching"],
      ["specialize", "Network security"],
      ["specialize", "Networking labs", "cisco_netacad"],
      ["career_ready", "Certification preparation"],
    ]),
  },
  {
    domainName: "Robotics & Automation",
    items: items("domain-robotics", [
      ["foundation", "Programming fundamentals"],
      ["foundation", "Electronics basics"],
      ["core", "Sensors"],
      ["core", "Microcontrollers"],
      ["specialize", "Control systems", "nptel", "control systems"],
      ["specialize", "ROS basics"],
      ["career_ready", "Robotics projects portfolio"],
    ]),
  },
  {
    domainName: "VLSI & Chip Design",
    items: items("domain-vlsi", [
      ["foundation", "Digital electronics", "nptel", "digital electronics"],
      ["foundation", "Verilog / VHDL basics"],
      ["core", "CMOS fundamentals"],
      ["core", "FPGA basics"],
      ["specialize", "VLSI design", "nptel", "VLSI design"],
      ["specialize", "EDA tools"],
      ["career_ready", "VLSI projects portfolio"],
    ]),
  },
  {
    domainName: "Mechanical Design & CAD",
    items: items("domain-mech-cad", [
      ["foundation", "Engineering drawing"],
      ["foundation", "CAD basics"],
      ["core", "Solid modelling"],
      ["core", "Simulation basics"],
      ["specialize", "CAE fundamentals", "nptel", "computer aided engineering"],
      ["specialize", "Product design"],
      ["career_ready", "Industry project experience"],
    ]),
  },
  {
    domainName: "UI/UX Design",
    items: items("domain-ui-ux", [
      ["foundation", "Design fundamentals"],
      ["foundation", "Figma basics"],
      ["core", "User research"],
      ["core", "Wireframing"],
      ["specialize", "Prototyping"],
      ["specialize", "Usability testing"],
      ["career_ready", "Design portfolio"],
    ]),
  },
];

const CAREER_TRACK_BY_GOAL = new Map(CAREER_TRACKS.map((t) => [t.goalName, t]));
const DOMAIN_PATHWAY_BY_DOMAIN = new Map(DOMAIN_PATHWAYS.map((p) => [p.domainName, p]));

export function careerTrackFor(goalName: string): CareerTrack | null {
  return CAREER_TRACK_BY_GOAL.get(goalName) ?? null;
}

export function domainPathwayFor(domainName: string): DomainPathway | null {
  return DOMAIN_PATHWAY_BY_DOMAIN.get(domainName) ?? null;
}
