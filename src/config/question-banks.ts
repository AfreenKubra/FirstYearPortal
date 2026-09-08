/**
 * Draft question banks for the six skill areas.
 *
 * ── Read this before publishing any of it ──────────────────────────────────
 *
 * These questions were drafted by an assistant, not written by a subject
 * lecturer and not moderated by anyone. They are seeded with
 * `is_published = false` for exactly that reason: the moment a paper here is
 * published, students are scored on it and those scores are shown to their
 * mentors as evidence about them. A wrong answer key in this file becomes a
 * wrong judgement about a real student.
 *
 * So the intended workflow is: seed → open each paper under
 * /faculty/assessments → read every question → correct or delete what is
 * wrong → publish. Nothing here is authoritative until a person has done
 * that.
 *
 * ── Why the content lives in a file ────────────────────────────────────────
 *
 * It could have gone straight into the database. Keeping it here means the
 * answer keys are in version control, reviewable in a diff, and covered by
 * the structural tests in `__tests__/question-banks.test.ts` — which hold
 * every single-choice question to exactly one correct option, catch duplicate
 * prompts, and check each bank against the length the brief asked for. Those
 * tests cannot tell you whether an answer is *right*; only a person reading
 * them can. They exist to catch the mechanical mistakes so a reviewer's
 * attention is free for the ones that matter.
 *
 * Question order is not fixed here either — the papers are seeded with
 * `randomise_questions` on, so the engine shuffles per attempt.
 */

import type { AssessmentKind, SkillCategoryId } from "@/config/assessments";

export type BankOption = {
  label: string;
  /** Exactly one per single-choice question. Absent on Likert items. */
  correct?: boolean;
  /** What this option contributes on a Likert scale. */
  scoreValue?: number;
};

export type BankQuestion = {
  /**
   * Stable within its bank. Used to re-seed without duplicating: a paper is
   * rebuilt from these ids rather than appended to.
   */
  id: string;
  prompt: string;
  kind: "single_choice" | "likert";
  options: BankOption[];
};

export type QuestionBank = {
  categoryId: SkillCategoryId;
  kind: AssessmentKind;
  title: string;
  description: string;
  durationMinutes: number;
  /** Percentage needed to pass, or null when a paper is not pass/fail. */
  passPercentage: number | null;
  questions: BankQuestion[];
};

const APTITUDE: QuestionBank = {
  categoryId: "aptitude",
  kind: "general",
  title: "Aptitude Assessment",
  description:
    "Quantitative aptitude, numerical ability, and data interpretation. 25 questions, 30 minutes.",
  durationMinutes: 30,
  passPercentage: 40,
  questions: [
    {
      id: "apt-01",
      prompt: "What is 15% of 240?",
      kind: "single_choice",
      options: [
        { label: "36", correct: true },
        { label: "38" },
        { label: "42" },
        { label: "32" },
      ],
    },
    {
      id: "apt-02",
      prompt:
        "A sum of ₹240 is divided between two people in the ratio 3 : 5. How much does the person with the larger share receive?",
      kind: "single_choice",
      options: [
        { label: "₹150", correct: true },
        { label: "₹160" },
        { label: "₹90" },
        { label: "₹120" },
      ],
    },
    {
      id: "apt-03",
      prompt:
        "A can finish a piece of work in 12 days and B can finish the same work in 18 days. Working together, how many days will they take?",
      kind: "single_choice",
      options: [
        { label: "15 days" },
        { label: "6 days" },
        { label: "7.2 days", correct: true },
        { label: "7.5 days" },
      ],
    },
    {
      id: "apt-04",
      prompt:
        "A fair coin is tossed three times. What is the probability of getting exactly two heads?",
      kind: "single_choice",
      options: [
        { label: "1/4" },
        { label: "1/3" },
        { label: "3/8", correct: true },
        { label: "1/2" },
      ],
    },
    {
      id: "apt-05",
      prompt:
        "The average of 5 numbers is 20. When one number is removed, the average of the remaining 4 becomes 18. What number was removed?",
      kind: "single_choice",
      options: [
        { label: "26" },
        { label: "28", correct: true },
        { label: "30" },
        { label: "22" },
      ],
    },
    {
      id: "apt-06",
      prompt:
        "Find the simple interest on ₹5,000 at 8% per annum for 3 years.",
      kind: "single_choice",
      options: [
        { label: "₹1,240" },
        { label: "₹1,400" },
        { label: "₹1,000" },
        { label: "₹1,200", correct: true },
      ],
    },
    {
      id: "apt-07",
      prompt:
        "An article bought for ₹400 is sold for ₹500. What is the profit percentage?",
      kind: "single_choice",
      options: [
        { label: "40%" },
        { label: "20%" },
        { label: "25%", correct: true },
        { label: "30%" },
      ],
    },
    {
      id: "apt-08",
      prompt:
        "A car covers 120 km in 1 hour 30 minutes. What is its average speed?",
      kind: "single_choice",
      options: [
        { label: "60 km/h" },
        { label: "75 km/h" },
        { label: "80 km/h", correct: true },
        { label: "90 km/h" },
      ],
    },
    {
      id: "apt-09",
      prompt:
        "A train 150 metres long is travelling at 20 metres per second. How long does it take to pass a stationary pole?",
      kind: "single_choice",
      options: [
        { label: "7.5 seconds", correct: true },
        { label: "10 seconds" },
        { label: "15 seconds" },
        { label: "5 seconds" },
      ],
    },
    {
      id: "apt-10",
      prompt:
        "The price of an item is ₹1,000. It is increased by 20% and then the new price is decreased by 20%. What is the final price?",
      kind: "single_choice",
      options: [
        { label: "₹960", correct: true },
        { label: "₹1,040" },
        { label: "₹1,000" },
        { label: "₹980" },
      ],
    },
    {
      id: "apt-11",
      prompt: "If 5 pens cost ₹75, what do 8 pens cost at the same rate?",
      kind: "single_choice",
      options: [
        { label: "₹125" },
        { label: "₹105" },
        { label: "₹110" },
        { label: "₹120", correct: true },
      ],
    },
    {
      id: "apt-12",
      prompt: "What is the LCM of 12 and 18?",
      kind: "single_choice",
      options: [
        { label: "24" },
        { label: "36", correct: true },
        { label: "54" },
        { label: "216" },
      ],
    },
    {
      id: "apt-13",
      prompt: "What is the HCF of 24 and 36?",
      kind: "single_choice",
      options: [
        { label: "8" },
        { label: "12", correct: true },
        { label: "18" },
        { label: "6" },
      ],
    },
    {
      id: "apt-14",
      prompt: "Solve for x: 2x + 7 = 19",
      kind: "single_choice",
      options: [
        { label: "12" },
        { label: "13" },
        { label: "5" },
        { label: "6", correct: true },
      ],
    },
    {
      id: "apt-15",
      prompt:
        "The compound interest on ₹1,000 at 10% per annum for 2 years, compounded annually, is:",
      kind: "single_choice",
      options: [
        { label: "₹1,210" },
        { label: "₹200" },
        { label: "₹210", correct: true },
        { label: "₹220" },
      ],
    },
    {
      id: "apt-16",
      prompt: "A student scores 45 out of 60 in a test. What percentage is that?",
      kind: "single_choice",
      options: [
        { label: "70%" },
        { label: "72%" },
        { label: "75%", correct: true },
        { label: "80%" },
      ],
    },
    {
      id: "apt-17",
      prompt:
        "6 workers complete a job in 12 days. Working at the same rate, how many days will 9 workers take?",
      kind: "single_choice",
      options: [
        { label: "8 days", correct: true },
        { label: "9 days" },
        { label: "18 days" },
        { label: "6 days" },
      ],
    },
    {
      id: "apt-18",
      prompt: "What is the average of 10, 20, 30 and 40?",
      kind: "single_choice",
      options: [
        { label: "30" },
        { label: "35" },
        { label: "20" },
        { label: "25", correct: true },
      ],
    },
    {
      id: "apt-19",
      prompt:
        "An item has a marked price of ₹800 and is sold at a 25% discount. What is the selling price?",
      kind: "single_choice",
      options: [
        { label: "₹640" },
        { label: "₹575" },
        { label: "₹600", correct: true },
        { label: "₹625" },
      ],
    },
    {
      id: "apt-20",
      prompt:
        "A fair six-sided die is rolled once. What is the probability of getting a number greater than 4?",
      kind: "single_choice",
      options: [
        { label: "1/6" },
        { label: "1/3", correct: true },
        { label: "1/2" },
        { label: "2/3" },
      ],
    },
    {
      id: "apt-21",
      prompt: "If a : b = 2 : 3 and b : c = 4 : 5, what is a : c?",
      kind: "single_choice",
      options: [
        { label: "8 : 15", correct: true },
        { label: "3 : 4" },
        { label: "5 : 8" },
        { label: "2 : 5" },
      ],
    },
    {
      id: "apt-22",
      prompt:
        "A college has 480 students. 60% are in first year and, of those, one quarter are in the AIML branch. How many first-year AIML students are there?",
      kind: "single_choice",
      options: [
        { label: "96" },
        { label: "120" },
        { label: "60" },
        { label: "72", correct: true },
      ],
    },
    {
      id: "apt-23",
      prompt:
        "A shop's sales over four months were ₹40,000, ₹55,000, ₹35,000 and ₹50,000. What were the mean monthly sales?",
      kind: "single_choice",
      options: [
        { label: "₹50,000" },
        { label: "₹42,500" },
        { label: "₹45,000", correct: true },
        { label: "₹47,500" },
      ],
    },
    {
      id: "apt-24",
      prompt:
        "In a class of 50 students, 30 study Python and 25 study Java. Every student studies at least one of the two. How many study both?",
      kind: "single_choice",
      options: [
        { label: "5", correct: true },
        { label: "10" },
        { label: "15" },
        { label: "20" },
      ],
    },
    {
      id: "apt-25",
      prompt:
        "A cyclist travels the first 30 km at 15 km/h and the next 30 km at 30 km/h. What is the average speed for the whole journey?",
      kind: "single_choice",
      options: [
        { label: "22.5 km/h" },
        { label: "24 km/h" },
        { label: "25 km/h" },
        { label: "20 km/h", correct: true },
      ],
    },
  ],
};

const LOGICAL_REASONING: QuestionBank = {
  categoryId: "logical_reasoning",
  kind: "general",
  title: "Logical Reasoning Assessment",
  description:
    "Series, patterns, deduction, syllogisms, analogies, and coding-decoding. 20 questions, 20 minutes.",
  durationMinutes: 20,
  passPercentage: 40,
  questions: [
    {
      id: "log-01",
      prompt: "What comes next in the series: 2, 6, 12, 20, 30, ?",
      kind: "single_choice",
      options: [
        { label: "36" },
        { label: "40" },
        { label: "42", correct: true },
        { label: "46" },
      ],
    },
    {
      id: "log-02",
      prompt: "What comes next in the series: 1, 4, 9, 16, 25, ?",
      kind: "single_choice",
      options: [
        { label: "30" },
        { label: "36", correct: true },
        { label: "49" },
        { label: "35" },
      ],
    },
    {
      id: "log-03",
      prompt: "Find the missing term: 3, 6, 12, 24, ?, 96",
      kind: "single_choice",
      options: [
        { label: "36" },
        { label: "48", correct: true },
        { label: "60" },
        { label: "72" },
      ],
    },
    {
      id: "log-04",
      prompt:
        "In a certain code, CAT is written as DBU. How is DOG written in the same code?",
      kind: "single_choice",
      options: [
        { label: "EPH", correct: true },
        { label: "EPG" },
        { label: "DPH" },
        { label: "CNF" },
      ],
    },
    {
      id: "log-05",
      prompt:
        "If in a code MOUSE is written as NPVTF, what does each letter shift by?",
      kind: "single_choice",
      options: [
        { label: "One place backward" },
        { label: "One place forward", correct: true },
        { label: "Two places forward" },
        { label: "It is reversed" },
      ],
    },
    {
      id: "log-06",
      prompt: "Book is to Reading as Fork is to:",
      kind: "single_choice",
      options: [
        { label: "Drawing" },
        { label: "Writing" },
        { label: "Eating", correct: true },
        { label: "Cooking" },
      ],
    },
    {
      id: "log-07",
      prompt: "Doctor is to Hospital as Teacher is to:",
      kind: "single_choice",
      options: [
        { label: "Student" },
        { label: "School", correct: true },
        { label: "Book" },
        { label: "Lesson" },
      ],
    },
    {
      id: "log-08",
      prompt:
        "All roses are flowers. Some flowers fade quickly. Which conclusion definitely follows?",
      kind: "single_choice",
      options: [
        { label: "All roses are among the flowers that fade quickly." },
        { label: "At least some roses are flowers that fade quickly." },
        { label: "No definite conclusion about roses can be drawn.", correct: true },
        { label: "No rose is among the flowers that fade quickly." },
      ],
    },
    {
      id: "log-09",
      prompt:
        "All engineers are graduates. Ravi is an engineer. Which conclusion definitely follows?",
      kind: "single_choice",
      options: [
        { label: "Ravi is a graduate.", correct: true },
        { label: "All graduates are engineers." },
        { label: "Ravi is not a graduate." },
        { label: "Nothing can be concluded." },
      ],
    },
    {
      id: "log-10",
      prompt:
        "Pointing to a photograph, a man says, \"She is the daughter of my mother's only son.\" How is the woman in the photograph related to him?",
      kind: "single_choice",
      options: [
        { label: "His sister" },
        { label: "His daughter", correct: true },
        { label: "His niece" },
        { label: "His cousin" },
      ],
    },
    {
      id: "log-11",
      prompt:
        "A man walks 5 km north, turns right and walks 3 km, then turns right again and walks 5 km. In which direction is he from his starting point?",
      kind: "single_choice",
      options: [
        { label: "North" },
        { label: "South" },
        { label: "East", correct: true },
        { label: "West" },
      ],
    },
    {
      id: "log-12",
      prompt: "Which one does not belong with the others?",
      kind: "single_choice",
      options: [
        { label: "Triangle" },
        { label: "Square" },
        { label: "Circle", correct: true },
        { label: "Rectangle" },
      ],
    },
    {
      id: "log-13",
      prompt:
        "Five friends sit in a row. Asha is to the immediate left of Bala. Bala is to the immediate left of Chetan. Who is in the middle of these three?",
      kind: "single_choice",
      options: [
        { label: "Asha" },
        { label: "Bala", correct: true },
        { label: "Chetan" },
        { label: "Cannot be determined" },
      ],
    },
    {
      id: "log-14",
      prompt:
        "If A is taller than B, and C is taller than A, who is the shortest of the three?",
      kind: "single_choice",
      options: [
        { label: "A" },
        { label: "B", correct: true },
        { label: "C" },
        { label: "Cannot be determined" },
      ],
    },
    {
      id: "log-15",
      prompt: "Complete the series: A, C, E, G, ?",
      kind: "single_choice",
      options: [
        { label: "H" },
        { label: "I", correct: true },
        { label: "J" },
        { label: "K" },
      ],
    },
    {
      id: "log-16",
      prompt: "Complete the series: 100, 81, 64, 49, ?",
      kind: "single_choice",
      options: [
        { label: "25" },
        { label: "36", correct: true },
        { label: "42" },
        { label: "38" },
      ],
    },
    {
      id: "log-17",
      prompt:
        "A statement says: \"If it rains, the match is cancelled.\" The match was not cancelled. What definitely follows?",
      kind: "single_choice",
      options: [
        { label: "It rained." },
        { label: "It did not rain.", correct: true },
        { label: "The match was postponed." },
        { label: "Nothing follows." },
      ],
    },
    {
      id: "log-18",
      prompt:
        "Four students are ranked by marks. Priya scored more than Rahul. Sana scored less than Rahul. Tarun scored more than Priya. Who ranked highest?",
      kind: "single_choice",
      options: [
        { label: "Priya" },
        { label: "Rahul" },
        { label: "Sana" },
        { label: "Tarun", correct: true },
      ],
    },
    {
      id: "log-19",
      prompt:
        "In a certain code, every letter is replaced by the letter two places after it in the alphabet. How is RICE written in this code?",
      kind: "single_choice",
      options: [
        { label: "TKEG", correct: true },
        { label: "SJDF" },
        { label: "PGAC" },
        { label: "TKGE" },
      ],
    },
    {
      id: "log-20",
      prompt:
        "A team must finish a task and can either work overtime today or add a person tomorrow, but not both. Overtime costs more but meets an earlier deadline. Which piece of information matters most in deciding?",
      kind: "single_choice",
      options: [
        { label: "Whether the earlier deadline is actually required", correct: true },
        { label: "How many people are currently working on the team" },
        { label: "Which category of work the task has been filed under" },
        { label: "Which member of the team suggested working overtime" },
      ],
    },
  ],
};

const TECHNICAL: QuestionBank = {
  categoryId: "technical",
  kind: "general",
  title: "Technical Aptitude Assessment",
  description:
    "Computational thinking, programming logic, flowcharts, basic algorithms, and computer fundamentals. 25 questions, 30 minutes. Not specific to any branch.",
  durationMinutes: 30,
  passPercentage: 40,
  questions: [
    {
      id: "tec-01",
      prompt: "What is an algorithm?",
      kind: "single_choice",
      options: [
        {
          label: "A finite, ordered sequence of steps that solves a problem",
          correct: true,
        },
        { label: "A programming language used to write instructions for a computer" },
        { label: "A hardware component that carries out arithmetic operations" },
        { label: "A format for storing structured data in a file on disk" },
      ],
    },
    {
      id: "tec-02",
      prompt:
        "In a flowchart, which shape is conventionally used for a decision?",
      kind: "single_choice",
      options: [
        { label: "Rectangle" },
        { label: "Diamond", correct: true },
        { label: "Oval" },
        { label: "Parallelogram" },
      ],
    },
    {
      id: "tec-03",
      prompt: "In a flowchart, an oval (terminator) usually represents:",
      kind: "single_choice",
      options: [
        { label: "A calculation or an assignment to a variable" },
        { label: "Data being read in or written out" },
        { label: "The start or end of the process", correct: true },
        { label: "A repeated step, executed more than once" },
      ],
    },
    {
      id: "tec-04",
      prompt:
        "What is the value of the variable `total` after this pseudocode runs?\n\n  total = 0\n  for i = 1 to 4\n      total = total + i\n  end for",
      kind: "single_choice",
      options: [
        { label: "4" },
        { label: "10", correct: true },
        { label: "15" },
        { label: "0" },
      ],
    },
    {
      id: "tec-05",
      prompt:
        "How many times does the body of this loop execute?\n\n  i = 0\n  while i < 5\n      i = i + 2\n  end while",
      kind: "single_choice",
      options: [
        { label: "2" },
        { label: "3", correct: true },
        { label: "5" },
        { label: "It never stops" },
      ],
    },
    {
      id: "tec-06",
      prompt:
        "What does this pseudocode print?\n\n  a = 5\n  b = 3\n  if a > b then\n      print \"A\"\n  else\n      print \"B\"\n  end if",
      kind: "single_choice",
      options: [
        { label: "A", correct: true },
        { label: "B" },
        { label: "Both A and B" },
        { label: "Nothing" },
      ],
    },
    {
      id: "tec-07",
      prompt: "What is the binary representation of the decimal number 10?",
      kind: "single_choice",
      options: [
        { label: "1010", correct: true },
        { label: "1100" },
        { label: "1001" },
        { label: "1110" },
      ],
    },
    {
      id: "tec-08",
      prompt: "What is the decimal value of the binary number 1101?",
      kind: "single_choice",
      options: [
        { label: "11" },
        { label: "12" },
        { label: "13", correct: true },
        { label: "14" },
      ],
    },
    {
      id: "tec-09",
      prompt: "How many bytes are there in one kilobyte (using 1 KB = 2^10 bytes)?",
      kind: "single_choice",
      options: [
        { label: "1000" },
        { label: "1024", correct: true },
        { label: "512" },
        { label: "2048" },
      ],
    },
    {
      id: "tec-10",
      prompt: "Which of these is system software rather than application software?",
      kind: "single_choice",
      options: [
        { label: "A spreadsheet program" },
        { label: "An operating system", correct: true },
        { label: "A web browser" },
        { label: "A photo editor" },
      ],
    },
    {
      id: "tec-11",
      prompt: "RAM is best described as:",
      kind: "single_choice",
      options: [
        { label: "Permanent storage that survives a power cut" },
        { label: "Volatile working memory that is cleared when power is lost", correct: true },
        { label: "The component that carries out a program's instructions" },
        { label: "A set of rules for sending data between computers" },
      ],
    },
    {
      id: "tec-12",
      prompt: "What does CPU stand for?",
      kind: "single_choice",
      options: [
        { label: "Central Processing Unit", correct: true },
        { label: "Computer Processing Utility" },
        { label: "Central Program Unit" },
        { label: "Control Peripheral Unit" },
      ],
    },
    {
      id: "tec-13",
      prompt: "A compiler is a program that:",
      kind: "single_choice",
      options: [
        { label: "Runs source code one line at a time as it reads it" },
        { label: "Translates source code into machine code before it is run", correct: true },
        { label: "Connects a computer to a network and manages its traffic" },
        { label: "Stores program data permanently on a disk between runs" },
      ],
    },
    {
      id: "tec-14",
      prompt:
        "A variable holds a person's age. Which data type is most appropriate?",
      kind: "single_choice",
      options: [
        { label: "Integer", correct: true },
        { label: "String" },
        { label: "Boolean" },
        { label: "Character" },
      ],
    },
    {
      id: "tec-15",
      prompt:
        "What is the result of the boolean expression: (true AND false) OR true",
      kind: "single_choice",
      options: [
        { label: "true", correct: true },
        { label: "false" },
        { label: "It is undefined" },
        { label: "It depends on the language" },
      ],
    },
    {
      id: "tec-16",
      prompt: "What is the value of 17 modulo 5 (the remainder of 17 ÷ 5)?",
      kind: "single_choice",
      options: [
        { label: "2", correct: true },
        { label: "3" },
        { label: "4" },
        { label: "0" },
      ],
    },
    {
      id: "tec-17",
      prompt:
        "In most programming languages, what is the index of the first element of an array?",
      kind: "single_choice",
      options: [
        { label: "0", correct: true },
        { label: "1" },
        { label: "-1" },
        { label: "It has no index" },
      ],
    },
    {
      id: "tec-18",
      prompt:
        "You need to check whether a number is even. Which test is correct?",
      kind: "single_choice",
      options: [
        { label: "The number divided by 2 leaves remainder 0", correct: true },
        { label: "The number divided by 2 leaves remainder 1" },
        { label: "The number is greater than 2" },
        { label: "The number ends in 5" },
      ],
    },
    {
      id: "tec-19",
      prompt:
        "A stack stores and retrieves items in which order?",
      kind: "single_choice",
      options: [
        { label: "First in, first out" },
        { label: "Last in, first out", correct: true },
        { label: "Smallest first" },
        { label: "Random order" },
      ],
    },
    {
      id: "tec-20",
      prompt: "A queue stores and retrieves items in which order?",
      kind: "single_choice",
      options: [
        { label: "First in, first out", correct: true },
        { label: "Last in, first out" },
        { label: "Largest first" },
        { label: "Random order" },
      ],
    },
    {
      id: "tec-21",
      prompt:
        "Binary search can be used on a list only when the list is:",
      kind: "single_choice",
      options: [
        { label: "Sorted", correct: true },
        { label: "Of even length" },
        { label: "Made only of integers" },
        { label: "Stored in a database" },
      ],
    },
    {
      id: "tec-22",
      prompt:
        "A program produces the wrong answer but does not crash. This is best described as:",
      kind: "single_choice",
      options: [
        { label: "A syntax error" },
        { label: "A logical error", correct: true },
        { label: "A hardware fault" },
        { label: "A network error" },
      ],
    },
    {
      id: "tec-23",
      prompt: "What is the main purpose of version control software such as Git?",
      kind: "single_choice",
      options: [
        {
          label: "To track changes to files over time and let people work together",
          correct: true,
        },
        { label: "To compile source code into a program more quickly" },
        { label: "To scan a computer for viruses and remove them" },
        { label: "To design and lay out an application's user interface" },
      ],
    },
    {
      id: "tec-24",
      prompt: "In a URL, what does HTTPS provide that HTTP does not?",
      kind: "single_choice",
      options: [
        { label: "Encryption of data in transit", correct: true },
        { label: "Faster page loading" },
        { label: "Free web hosting" },
        { label: "Automatic spelling correction" },
      ],
    },
    {
      id: "tec-25",
      prompt:
        "You must find the largest number in an unsorted list of 1,000 numbers. What is the minimum number of items you must look at?",
      kind: "single_choice",
      options: [
        { label: "1, because the largest is always at one of the ends" },
        { label: "10, a sample large enough to be representative" },
        { label: "500, since checking half the list is enough" },
        { label: "1,000 — every item must be checked", correct: true },
      ],
    },
  ],
};

const COMMUNICATION: QuestionBank = {
  categoryId: "communication",
  kind: "english",
  title: "Communication Skills Assessment",
  description:
    "Vocabulary, grammar, comprehension, sentence correction, and professional communication. 20 questions, 20 minutes.",
  durationMinutes: 20,
  passPercentage: 40,
  questions: [
    {
      id: "com-01",
      prompt: "Choose the word closest in meaning to CONCISE.",
      kind: "single_choice",
      options: [
        { label: "Brief", correct: true },
        { label: "Complicated" },
        { label: "Careless" },
        { label: "Detailed" },
      ],
    },
    {
      id: "com-02",
      prompt: "Choose the word opposite in meaning to RELUCTANT.",
      kind: "single_choice",
      options: [
        { label: "Hesitant" },
        { label: "Willing", correct: true },
        { label: "Unsure" },
        { label: "Slow" },
      ],
    },
    {
      id: "com-03",
      prompt: "Choose the word closest in meaning to DILIGENT.",
      kind: "single_choice",
      options: [
        { label: "Hard-working", correct: true },
        { label: "Intelligent" },
        { label: "Friendly" },
        { label: "Wealthy" },
      ],
    },
    {
      id: "com-04",
      prompt: "Choose the correctly spelled word.",
      kind: "single_choice",
      options: [
        { label: "Recieve" },
        { label: "Receive", correct: true },
        { label: "Receeve" },
        { label: "Recive" },
      ],
    },
    {
      id: "com-05",
      prompt: "Fill in the blank: She ____ in Bengaluru since 2019.",
      kind: "single_choice",
      options: [
        { label: "lives" },
        { label: "is living" },
        { label: "has lived", correct: true },
        { label: "lived" },
      ],
    },
    {
      id: "com-06",
      prompt: "Fill in the blank: Neither the students nor the teacher ____ arrived.",
      kind: "single_choice",
      options: [
        { label: "have" },
        { label: "has", correct: true },
        { label: "are" },
        { label: "were" },
      ],
    },
    {
      id: "com-07",
      prompt: "Choose the grammatically correct sentence.",
      kind: "single_choice",
      options: [
        { label: "He don't know the answer." },
        { label: "He doesn't knows the answer." },
        { label: "He doesn't know the answer.", correct: true },
        { label: "He not know the answer." },
      ],
    },
    {
      id: "com-08",
      prompt: "Identify the sentence with the correct use of an apostrophe.",
      kind: "single_choice",
      options: [
        { label: "The students' projects were submitted on time.", correct: true },
        { label: "The student's projects was submitted on time." },
        { label: "The students projects' were submitted on time." },
        { label: "The students project's were submitted on time." },
      ],
    },
    {
      id: "com-09",
      prompt: "Correct the sentence: \"The list of items are on the desk.\"",
      kind: "single_choice",
      options: [
        { label: "The list of items is on the desk.", correct: true },
        { label: "The lists of item are on the desk." },
        { label: "The list of items were on the desk." },
        { label: "The sentence is already correct." },
      ],
    },
    {
      id: "com-10",
      prompt: "Choose the correct word: The team performed well ____ the difficult conditions.",
      kind: "single_choice",
      options: [
        { label: "although" },
        { label: "despite", correct: true },
        { label: "however" },
        { label: "because" },
      ],
    },
    {
      id: "com-11",
      prompt: "Which sentence is written in the passive voice?",
      kind: "single_choice",
      options: [
        { label: "The committee approved the proposal." },
        { label: "The proposal was approved by the committee.", correct: true },
        { label: "The committee will approve the proposal." },
        { label: "Approve the proposal." },
      ],
    },
    {
      id: "com-12",
      prompt:
        "Read the passage and answer the question.\n\n\"Rainwater harvesting collects and stores rain for later use. In cities, it eases pressure on the mains supply and reduces flooding after heavy rain. Its main limitation is that a long dry spell leaves the tanks empty.\"\n\nAccording to the passage, what is the main limitation of rainwater harvesting?",
      kind: "single_choice",
      options: [
        { label: "The tanks are expensive to install and maintain" },
        { label: "It cannot be used in densely built-up cities" },
        { label: "A long dry spell leaves the tanks empty", correct: true },
        { label: "It increases flooding after periods of heavy rain" },
      ],
    },
    {
      id: "com-13",
      prompt:
        "Read the passage and answer the question.\n\n\"Rainwater harvesting collects and stores rain for later use. In cities, it eases pressure on the mains supply and reduces flooding after heavy rain. Its main limitation is that a long dry spell leaves the tanks empty.\"\n\nWhich benefit in cities does the passage mention?",
      kind: "single_choice",
      options: [
        { label: "It reduces flooding after heavy rain", correct: true },
        { label: "It lowers electricity bills" },
        { label: "It improves air quality" },
        { label: "It replaces the mains supply entirely" },
      ],
    },
    {
      id: "com-14",
      prompt:
        "You are emailing a lecturer you have not met to ask about a project. Which opening is most appropriate?",
      kind: "single_choice",
      options: [
        { label: "Hey, I need some information about the project when you get a chance" },
        { label: "Dear Dr Rao, I am a first-year student and I would like to ask about the project.", correct: true },
        { label: "Respected Sir, kindly do the needful regarding the project at the earliest" },
        { label: "Hi, I have a few urgent questions about the project, please reply soon!!" },
      ],
    },
    {
      id: "com-15",
      prompt: "What is the purpose of the subject line in a professional email?",
      kind: "single_choice",
      options: [
        { label: "To state briefly what the email is about", correct: true },
        { label: "To greet the recipient" },
        { label: "To list every detail of the message" },
        { label: "To sign off the message" },
      ],
    },
    {
      id: "com-16",
      prompt:
        "You have to tell a team member their section of a report needs rewriting. Which response communicates this best?",
      kind: "single_choice",
      options: [
        { label: "\"Your section is not good enough and will need to be done again.\"" },
        {
          label: "\"The section reads well, but it does not yet cover the cost analysis the brief asks for.\"",
          correct: true,
        },
        { label: "Say nothing about it and quietly rewrite the section yourself before Friday." },
        { label: "Raise the gap with the rest of the team first, so it does not come from you alone." },
      ],
    },
    {
      id: "com-17",
      prompt: "Active listening in a discussion is best shown by:",
      kind: "single_choice",
      options: [
        { label: "Waiting quietly for your turn without interrupting the speaker" },
        { label: "Summarising what the other person said before responding", correct: true },
        { label: "Agreeing with each point so the discussion keeps moving forward" },
        { label: "Making notes throughout so nothing that was said is forgotten later" },
      ],
    },
    {
      id: "com-18",
      prompt: "Which sentence is the clearest?",
      kind: "single_choice",
      options: [
        {
          label: "Due to the fact that there was an absence of clarity, the meeting was postponed.",
        },
        { label: "The meeting was postponed because the brief was unclear.", correct: true },
        { label: "Postponement of the meeting occurred, unclarity being the cause." },
        { label: "It was postponed, the meeting, unclear brief." },
      ],
    },
    {
      id: "com-19",
      prompt: "Choose the correct word: The results had a significant ____ on the decision.",
      kind: "single_choice",
      options: [
        { label: "affect" },
        { label: "effect", correct: true },
        { label: "effort" },
        { label: "affection" },
      ],
    },
    {
      id: "com-20",
      prompt:
        "In a group presentation, a listener asks a question you cannot answer. What is the best response?",
      kind: "single_choice",
      options: [
        { label: "Offer your best guess, so the presentation does not stall on an awkward pause" },
        { label: "Say you do not have that figure to hand and will follow up after the session", correct: true },
        { label: "Explain that the question falls outside the scope of what you were asked to cover" },
        { label: "Hand straight over to a teammate and continue with the next part of the slides" },
      ],
    },
  ],
};

const SOFT_SKILLS: QuestionBank = {
  categoryId: "soft_skills",
  kind: "general",
  title: "Soft Skills Assessment",
  description:
    "Scenario-based questions on teamwork, leadership, adaptability, time management, and conflict resolution. Indicative only \u2014 this is not a psychological or medical assessment.",
  durationMinutes: 20,
  passPercentage: null,
  questions: [
    {
      id: "sof-01",
      prompt:
        "Your group project is due on Friday and one member has not sent their part. It is Wednesday. What is the most constructive first step?",
      kind: "single_choice",
      options: [
        { label: "Email the lecturer to report that the member has not contributed anything" },
        { label: "Message them directly to ask where they have got to and whether they need help", correct: true },
        { label: "Quietly write their section yourself so the deadline is not at risk" },
        { label: "Wait until Friday morning and raise it then if it still has not arrived" },
      ],
    },
    {
      id: "sof-02",
      prompt:
        "Two teammates disagree strongly about the approach and the discussion has stalled. What is the most useful thing to do?",
      kind: "single_choice",
      options: [
        { label: "Back whichever of them has more experience with this kind of work" },
        { label: "Put the two approaches to an immediate vote and go with the majority" },
        { label: "Ask each what outcome they are protecting, then look for an option that meets both", correct: true },
        { label: "Park the decision and come back to it once tempers have settled" },
      ],
    },
    {
      id: "sof-03",
      prompt:
        "You are given a task that needs a tool you have never used, with a week until the deadline. What is the best first move?",
      kind: "single_choice",
      options: [
        { label: "Spend a fixed short period learning the basics, then reassess what is realistic", correct: true },
        { label: "Ask to swap for a task that uses something you already know well" },
        { label: "Begin the work straight away and pick the tool up as problems come up" },
        { label: "Ask a teammate who knows the tool to walk you through all of it first" },
      ],
    },
    {
      id: "sof-04",
      prompt:
        "You have four pieces of work due the same week and cannot finish all of them well. What is the most responsible approach?",
      kind: "single_choice",
      options: [
        { label: "Give each of the four the same reduced effort so all are submitted on time" },
        { label: "Complete the three you can do quickly and leave the fourth unsubmitted" },
        { label: "Rank them by deadline and weight, and warn whoever is affected that one slips", correct: true },
        { label: "Keep going and request an extension once it is clear you will not finish" },
      ],
    },
    {
      id: "sof-05",
      prompt:
        "A lecturer gives you critical feedback on work you were proud of. What is the most useful response?",
      kind: "single_choice",
      options: [
        { label: "Explain the reasoning behind your choices so the feedback can be reconsidered" },
        { label: "Ask which parts specifically to change and what a stronger version looks like", correct: true },
        { label: "Thank them, accept the mark, and apply the lesson to the next piece instead" },
        { label: "Check with another lecturer whether they read the work the same way" },
      ],
    },
    {
      id: "sof-06",
      prompt:
        "You are leading a team of five and one member is much quieter than the others in meetings. What is the best approach?",
      kind: "single_choice",
      options: [
        { label: "Give them work that does not depend on speaking up in group sessions" },
        { label: "Ask in the meeting why they never contribute, so the issue is out in the open" },
        { label: "Assume they will speak when they have something they want to say" },
        { label: "Ask them directly for their view on one point, or offer a way to reply in writing", correct: true },
      ],
    },
    {
      id: "sof-07",
      prompt:
        "Halfway through a project the requirements change significantly. What is the most adaptable response?",
      kind: "single_choice",
      options: [
        { label: "Work out what of the existing work still applies, then re-plan the rest together", correct: true },
        { label: "Continue to the original plan, since that is what the team agreed to deliver" },
        { label: "Discard what exists and rebuild against the new requirements from scratch" },
        { label: "Pause the work until whoever changed the requirements confirms them in writing" },
      ],
    },
    {
      id: "sof-08",
      prompt:
        "You realise you have made a mistake that will affect the team's deadline. What should you do?",
      kind: "single_choice",
      options: [
        { label: "Correct it as fast as you can and mention it only if the deadline actually slips" },
        { label: "Tell the team as soon as you know, together with what you propose to do about it", correct: true },
        { label: "Wait for the next stand-up so the whole team hears it at the same time" },
        { label: "Raise it as a process problem rather than as something you personally got wrong" },
      ],
    },
    {
      id: "sof-09",
      prompt:
        "A teammate consistently does good work but misses every meeting. What is the most reasonable first step?",
      kind: "single_choice",
      options: [
        { label: "Bring it up with the whole group so everyone hears the same expectation" },
        { label: "Leave it alone, given that the work itself is arriving and is good" },
        { label: "Ask them privately whether the meeting time is a problem for them", correct: true },
        { label: "Stop relying on them for anything decided during the meetings" },
      ],
    },
    {
      id: "sof-10",
      prompt:
        "You are asked to give an update on work that is behind schedule. What is the best way to present it?",
      kind: "single_choice",
      options: [
        { label: "Say it is nearly there, so the meeting can focus on the parts that are working" },
        { label: "Explain in detail how much harder the task turned out to be than expected" },
        { label: "Hold off on a revised date until you are confident you can meet it" },
        { label: "State where it actually stands, why it slipped, and what the revised date is", correct: true },
      ],
    },
    {
      id: "sof-11",
      prompt:
        "You disagree with a decision the group has already made and started acting on. What is the most constructive option?",
      kind: "single_choice",
      options: [
        { label: "Raise the specific concern once with your reasoning, then accept the group's call", correct: true },
        { label: "Go along with it for now and say what you thought if it turns out badly" },
        { label: "Keep the discussion open until the group has properly understood the objection" },
        { label: "Do your part but make clear you are not accountable for that decision" },
      ],
    },
    {
      id: "sof-12",
      prompt:
        "You have finished your part of a group task early. What is the most useful thing to do?",
      kind: "single_choice",
      options: [
        { label: "Go back over your own section and improve it further while there is time" },
        { label: "Ask the team which part is furthest behind and offer to take some of it", correct: true },
        { label: "Wait to be asked, so you do not tread on anyone else's section" },
        { label: "Start reviewing a teammate's work and correcting it in your own style" },
      ],
    },
    {
      id: "sof-13",
      prompt:
        "During a busy week you notice you are consistently working late and still falling behind. What is the sensible response?",
      kind: "single_choice",
      options: [
        { label: "Extend your working hours further until the backlog has been cleared" },
        { label: "Drop the subject you find hardest so the remaining work becomes manageable" },
        { label: "Keep the current pace and see whether next week is naturally lighter" },
        { label: "Find what is consuming the time and cut or hand off something, not add hours", correct: true },
      ],
    },
    {
      id: "sof-14",
      prompt:
        "A junior student asks you for help with something you found difficult yourself. What is the most helpful response?",
      kind: "single_choice",
      options: [
        { label: "Give them the working answer so they are not stuck on it any longer" },
        { label: "Reassure them that it seems hard at first but becomes obvious with practice" },
        { label: "Walk them through how you worked it out, including what confused you", correct: true },
        { label: "Send them the resource that helped you and offer to talk if they are stuck" },
      ],
    },
    {
      id: "sof-15",
      prompt:
        "Your team's plan depends on something outside your control that may not arrive in time. What is the best preparation?",
      kind: "single_choice",
      options: [
        { label: "Assume it arrives on schedule and plan the rest of the work around that" },
        { label: "Hold the dependent work back until the thing has actually turned up" },
        { label: "Raise it with whoever owns it now so the risk sits with them instead" },
        { label: "Agree in advance what you will do if it does not arrive, and when you decide", correct: true },
      ],
    },
  ],
};

/**
 * Likert items, five points, never reported as a score.
 *
 * The engine does compute a total for Likert questions — that is how it
 * stores an answer at all — but the dashboard never surfaces it: `readiness.ts`
 * returns null for this category's percentage, and the card reports
 * "Personality profile completed" instead. There is no right answer to any
 * item below, and presenting a total as an achievement would turn a
 * self-description into a mark out of 100.
 *
 * `PSYCHOMETRIC_DISCLOSURE` is shown on the sitting screen by the engine, so
 * it is not repeated in the description here.
 */
const LIKERT_OPTIONS: BankOption[] = [
  { label: "Strongly disagree", scoreValue: 1 },
  { label: "Disagree", scoreValue: 2 },
  { label: "Neither agree nor disagree", scoreValue: 3 },
  { label: "Agree", scoreValue: 4 },
  { label: "Strongly agree", scoreValue: 5 },
];

const PERSONALITY_STATEMENTS: Array<{ id: string; prompt: string }> = [
  { id: "per-01", prompt: "I prefer to plan my work in advance rather than decide as I go." },
  { id: "per-02", prompt: "I do my best thinking when I talk a problem through with other people." },
  { id: "per-03", prompt: "I am comfortable starting something before all the details are settled." },
  { id: "per-04", prompt: "I would rather take on a task nobody has claimed than wait to be assigned one." },
  { id: "per-05", prompt: "I learn a new skill fastest by reading about it before trying it." },
  { id: "per-06", prompt: "I learn a new skill fastest by attempting it and correcting mistakes as I go." },
  { id: "per-07", prompt: "I find it easy to keep working on something when the result is a long way off." },
  { id: "per-08", prompt: "I prefer clear instructions to open-ended freedom." },
  { id: "per-09", prompt: "I am usually the person who keeps track of what the group has agreed." },
  { id: "per-10", prompt: "I make decisions quickly and adjust later if needed." },
  { id: "per-11", prompt: "I prefer to gather as much information as I can before deciding." },
  { id: "per-12", prompt: "I am comfortable disagreeing with a group I am part of." },
  { id: "per-13", prompt: "I would rather work steadily over weeks than intensively close to a deadline." },
  { id: "per-14", prompt: "I notice when someone in a group has gone quiet." },
  { id: "per-15", prompt: "I enjoy work where the problem is not clearly defined at the start." },
  { id: "per-16", prompt: "I ask for help early rather than trying everything myself first." },
  { id: "per-17", prompt: "I find it satisfying to improve something that already works." },
  { id: "per-18", prompt: "I would rather present the team's work than write it up." },
  { id: "per-19", prompt: "I keep going at a task even when I have stopped enjoying it." },
  { id: "per-20", prompt: "I am usually the one who suggests trying a different approach." },
];

const PERSONALITY: QuestionBank = {
  categoryId: "personality",
  kind: "psychometric",
  title: "Personality Profile",
  description:
    "Twenty statements about how you prefer to work. There are no right or wrong answers, and no pass mark. Answer as you actually are rather than as you think you should be.",
  durationMinutes: 15,
  passPercentage: null,
  questions: PERSONALITY_STATEMENTS.map((statement) => ({
    id: statement.id,
    prompt: statement.prompt,
    kind: "likert" as const,
    options: LIKERT_OPTIONS,
  })),
};

export const QUESTION_BANKS: readonly QuestionBank[] = [
  APTITUDE,
  LOGICAL_REASONING,
  TECHNICAL,
  COMMUNICATION,
  SOFT_SKILLS,
  PERSONALITY,
];

export function bankFor(categoryId: SkillCategoryId): QuestionBank | null {
  return QUESTION_BANKS.find((b) => b.categoryId === categoryId) ?? null;
}
