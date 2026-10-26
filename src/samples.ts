export const blankDocument = () => ({
  id: crypto.randomUUID(),
  title: "",
  role: "overview",
  text: "",
  url: "",
  coverage: { criteria: false, deliverables: false },
  inputMethod: "paste",
});
export const sampleDocuments = () => [
  {
    ...blankDocument(),
    title: "Event overview",
    role: "overview",
    inputMethod: "synthetic",
    coverage: { criteria: true, deliverables: true },
    text: "SYNTHETIC EXAMPLE — Field Notes Hackathon\n\nDemo video must be at most 3 minutes.\nTeams must have at most 4 people.\nSubmission deadline: October 26 2026 at 5:00 pm EDT.\n\nJudging criteria: Design, Innovation, Presentation\n\nYou must submit a public code repository and a demo video.",
  },
  {
    ...blankDocument(),
    title: "Official rules",
    role: "official rules",
    inputMethod: "synthetic",
    coverage: { criteria: true, deliverables: true },
    text: "SYNTHETIC EXAMPLE — Field Notes Hackathon\n\nDemo video must be under 3 minutes.\nTeams must have at most 4 people.\nSubmission deadline: October 26 2026 at 4:00 pm CDT.\n\nJudging criteria: Design, Potential Impact, Innovation, Presentation\n\nYou must submit a public code repository and a demo video.",
  },
];
export const observedDocuments = () => [
  {
    ...blankDocument(),
    title: "Build With AI: Basics — overview excerpt",
    role: "overview",
    url: "https://learn-ai-basics.devpost.com/",
    coverage: { criteria: true, deliverables: false },
    inputMethod: "paste",
    provenance: {
      capturedAt: "2026-10-25",
      kind: "Observed public excerpt; manually checked on October 25, 2026. Not a live import.",
    },
    text: "Judging Criteria\n- Design\n- Innovation/Idea\n- Presentation",
  },
  {
    ...blankDocument(),
    title: "Build With AI: Basics — rules excerpt",
    role: "official rules",
    url: "https://learn-ai-basics.devpost.com/rules",
    coverage: { criteria: true, deliverables: false },
    inputMethod: "paste",
    provenance: {
      capturedAt: "2026-10-25",
      kind: "Observed public excerpt; manually checked on October 25, 2026. Not a live import.",
    },
    text: "Judging Criteria\n- Design\n- Potential Impact\n- Innovation/Idea\n- Presentation",
  },
];
