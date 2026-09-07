import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { goalTrackFor } from "@/config/goal-tracks";
import type { OfficialLink } from "@/config/goal-tracks";

/**
 * What a student's chosen career goal actually asks of them.
 *
 * This replaced a dead end. The roadmap previously showed an exam countdown
 * for the one goal that had dated exams in the catalogue and nothing at all
 * for the other seven — so a student aiming at software employment was told
 * "no exam track", which was true and useless. Hiring there was never about
 * an exam.
 *
 * Every link is an official source that was fetched and returned 200 when it
 * was added: the examining body, the ministry, or the test owner. None of the
 * copy states a date, fee, or eligibility rule — those change each cycle, and
 * a stale one shown here would be read as authoritative. Dated exams still
 * come from the admin-curated catalogue, where a person maintains them, and
 * render in `ExamTrackPanel` above this.
 */
function LinkRow({ link }: { link: OfficialLink }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        {link.label} ↗
      </a>
      <span className="text-xs text-ink-faint">{link.note}</span>
    </li>
  );
}

export function GoalTrackPanel({ goalName }: { goalName: string }) {
  const track = goalTrackFor(goalName);

  // A goal with no track defined renders nothing rather than an apology. The
  // config covers every seeded goal, and a test holds it to that.
  if (!track) return null;

  return (
    <Card as="section">
      <CardHeader title={track.heading} description={track.summary} />
      <CardBody className="space-y-5">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brass-700">
            What this asks of you
          </h3>
          <ul className="space-y-1.5">
            {track.focus.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink">
                <span aria-hidden="true" className="text-ink-faint">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {track.exams.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brass-700">
              Exams worth knowing about
            </h3>
            <ul className="space-y-1.5">
              {track.exams.map((exam) => (
                <LinkRow key={exam.url + exam.label} link={exam} />
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brass-700">
            Official sources
          </h3>
          <ul className="space-y-1.5">
            {track.officialLinks.map((link) => (
              <LinkRow key={link.url + link.label} link={link} />
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
            Dates, fees, and eligibility live on these pages, not here — they
            change every cycle, and a copy kept in this portal would go stale
            without anyone noticing. Always confirm on the official site before
            you plan around anything.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
