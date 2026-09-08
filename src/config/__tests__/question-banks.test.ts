import { describe, expect, it } from "vitest";
import { SKILL_CATEGORIES } from "../assessments";
import { QUESTION_BANKS, bankFor } from "../question-banks";

/**
 * Mechanical checks only.
 *
 * Nothing here can tell you whether an answer key is *right* — that needs a
 * person who knows the subject, and it is why every bank is seeded
 * unpublished. What these tests do is take the mechanical failures off the
 * reviewer's plate: a question with two correct answers, a question with
 * none, a duplicated prompt, an option list of one. Those are the mistakes
 * that are tedious to spot by eye and easy to catch here, so a reviewer's
 * attention stays on the content.
 */
describe("QUESTION_BANKS", () => {
  it("covers all six skill areas exactly once", () => {
    const ids = QUESTION_BANKS.map((b) => b.categoryId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of SKILL_CATEGORIES) {
      expect(bankFor(category.id), `no bank for ${category.id}`).not.toBeNull();
    }
  });

  it("matches the length and timing each area was specified with", () => {
    const expected: Record<string, { count: number; minutes: number }> = {
      aptitude: { count: 25, minutes: 30 },
      logical_reasoning: { count: 20, minutes: 20 },
      technical: { count: 25, minutes: 30 },
      communication: { count: 20, minutes: 20 },
      soft_skills: { count: 15, minutes: 20 },
      personality: { count: 20, minutes: 15 },
    };

    for (const bank of QUESTION_BANKS) {
      const spec = expected[bank.categoryId];
      expect(bank.questions.length, `${bank.categoryId} question count`).toBe(spec.count);
      expect(bank.durationMinutes, `${bank.categoryId} duration`).toBe(spec.minutes);
    }
  });

  it("gives every single-choice question exactly one correct option", () => {
    for (const bank of QUESTION_BANKS) {
      for (const question of bank.questions) {
        if (question.kind !== "single_choice") continue;
        const correct = question.options.filter((o) => o.correct === true);
        expect(
          correct.length,
          `${bank.categoryId}/${question.id} has ${correct.length} correct options`,
        ).toBe(1);
      }
    }
  });

  it("gives every question at least three options to choose between", () => {
    for (const bank of QUESTION_BANKS) {
      for (const question of bank.questions) {
        expect(
          question.options.length,
          `${bank.categoryId}/${question.id}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses no duplicate question ids or prompts within a bank", () => {
    for (const bank of QUESTION_BANKS) {
      const ids = bank.questions.map((q) => q.id);
      const prompts = bank.questions.map((q) => q.prompt);
      expect(new Set(ids).size, `${bank.categoryId} duplicate ids`).toBe(ids.length);
      expect(
        new Set(prompts).size,
        `${bank.categoryId} duplicate prompts`,
      ).toBe(prompts.length);
    }
  });

  it("uses no duplicate option labels within a question", () => {
    for (const bank of QUESTION_BANKS) {
      for (const question of bank.questions) {
        const labels = question.options.map((o) => o.label);
        expect(
          new Set(labels).size,
          `${bank.categoryId}/${question.id} repeats an option`,
        ).toBe(labels.length);
      }
    }
  });

  it("keeps prompts and options inside the lengths the database allows", () => {
    // `questions.prompt` is checked 3-2000 and `question_options.label`
    // 1-500 in 0013. A bank that violates these fails at seed time with a
    // constraint error rather than here, which is a much worse place to
    // find out.
    for (const bank of QUESTION_BANKS) {
      for (const question of bank.questions) {
        expect(question.prompt.trim().length).toBeGreaterThanOrEqual(3);
        expect(question.prompt.length).toBeLessThanOrEqual(2000);
        for (const option of question.options) {
          expect(option.label.trim().length).toBeGreaterThanOrEqual(1);
          expect(option.label.length).toBeLessThanOrEqual(500);
        }
      }
      expect(bank.title.trim().length).toBeGreaterThanOrEqual(3);
      expect(bank.title.length).toBeLessThanOrEqual(200);
      expect(bank.description.length).toBeLessThanOrEqual(2000);
    }
  });

  it("never marks an answer correct on the personality questionnaire", () => {
    // A personality item with a "right" answer would turn a self-description
    // into a test the student can fail.
    const personality = bankFor("personality");
    expect(personality).not.toBeNull();
    expect(personality?.passPercentage).toBeNull();
    for (const question of personality?.questions ?? []) {
      expect(question.kind).toBe("likert");
      expect(question.options.every((o) => o.correct === undefined)).toBe(true);
      expect(question.options.every((o) => typeof o.scoreValue === "number")).toBe(true);
    }
  });

  it("gives soft skills no pass mark either", () => {
    // Scenario judgement has better and worse answers, but "failed soft
    // skills" is not a verdict this portal should be issuing about anyone.
    expect(bankFor("soft_skills")?.passPercentage).toBeNull();
  });

  it("does not leak the answer by making the correct option much longer than the rest", () => {
    // A well-known giveaway: if the right answer is reliably the wordiest
    // option, the paper measures test-taking rather than the subject.
    //
    // What is measured is the *margin*, not merely which option is longest.
    // An answer one character longer than its distractors is not something a
    // student can exploit; one half again as long as anything else is. The
    // crude "is it the longest" version of this check failed on banks whose
    // options were within a few characters of each other, which would have
    // meant padding good distractors to satisfy a test.
    //
    // Only prose options are judged. On a numeric question the lengths are a
    // property of the arithmetic — "₹1,200" is longer than "₹200" because it
    // is bigger, not because it is the answer.
    const isProse = (question: { options: ReadonlyArray<{ label: string }> }) =>
      question.options.some((o) => o.label.trim().split(/\s+/).length >= 4);

    for (const bank of QUESTION_BANKS) {
      for (const question of bank.questions) {
        if (question.kind !== "single_choice" || !isProse(question)) continue;

        const correct = question.options.find((o) => o.correct === true);
        const longestOther = Math.max(
          ...question.options.filter((o) => o.correct !== true).map((o) => o.label.length),
        );
        if (!correct) continue;

        expect(
          correct.label.length / longestOther,
          `${bank.categoryId}/${question.id}: the correct option is ${correct.label.length} characters against ${longestOther} for the longest distractor`,
        ).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it("does not put the correct answer in the same position every time", () => {
    for (const bank of QUESTION_BANKS) {
      const positions = bank.questions
        .filter((q) => q.kind === "single_choice")
        .map((q) => q.options.findIndex((o) => o.correct === true));
      if (positions.length === 0) continue;

      const counts = new Map<number, number>();
      for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
      const commonest = Math.max(...counts.values());

      expect(
        commonest / positions.length,
        `${bank.categoryId}: the answer sits in one position ${commonest} of ${positions.length} times`,
      ).toBeLessThan(0.6);
    }
  });
});
