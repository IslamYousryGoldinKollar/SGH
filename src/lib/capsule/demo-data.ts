import { CREW_SIZE, type CapsuleConstitution, type CapsuleCrewInput, type CapsuleThemes } from "./types";

/** Rehearsal content for `/capsule/demo`: clearly sample copy, never real data. */

type FourAnswers = [unique: string, whoCanJoin: string, never: string, appreciate: string];

const SAMPLE: Array<[leader: string, crew: string, answers: FourAnswers]> = [
  ["Omar", "The Navigators", [
    "We move fast and still take the time to care about each other.",
    "Anyone curious, kind and ready to share the work.",
    "Leave a colleague behind when a deadline gets tough.",
    "People who genuinely show up for each other, even on a Friday night.",
  ]],
  ["Sara", "Sunrise Crew", [
    "Our customers sit at the centre of every decision, not in a slide deck.",
    "Anyone who listens first and speaks up honestly.",
    "Say 'that's not my department'.",
    "The open-door feeling: you can ask anyone, at any level, and get a real answer.",
  ]],
  ["Mohamed", "Palm Pioneers", [
    "We know the network connects millions of families, and we are proud of it.",
    "Everyone who wants to grow and help others grow.",
    "Hide a mistake instead of learning from it.",
    "Teamwork. Nobody gets left behind.",
  ]],
  ["Nour", "Coral Squad", [
    "A mix of experience and fresh energy that actually listens to each other.",
    "Anyone brave enough to ask questions and humble enough to hear answers.",
    "Blame a person before looking at the problem.",
    "Learning is part of the job: we are encouraged to grow.",
  ]],
  ["Karim", "The Tidal Wave", [
    "We solve problems together instead of looking for who to blame.",
    "People who respect everyone, from the first day to the last.",
    "Let a good idea wait for weeks in an approval chain.",
    "Respect: people thank each other and mean it.",
  ]],
  ["Hana", "Lagoon Legends", [
    "Resilience. We keep the network running no matter what.",
    "Anyone who treats colleagues like family.",
    "Send an urgent request with no context.",
    "The family spirit: colleagues become friends.",
  ]],
  ["Youssef", "North Coast Navigators", [
    "Big-company stability with a start-up appetite for new ideas.",
    "Anyone who brings ideas and brings others along.",
    "Work in silos, every team on its own little island.",
    "Managers who listen before they decide.",
  ]],
  ["Mariam", "Seashell Society", [
    "Diversity of people and backgrounds, all under one brand.",
    "Everyone, whatever their background, who shares our values.",
    "Skip the thank-you after someone helps.",
    "We celebrate wins together, big or small.",
  ]],
];

const PALETTES: Array<[sky: string, sea: string, accent: string]> = [
  ["#ffd9c9", "#181F4B", "#E00800"],
  ["#d7efe3", "#16363A", "#47CB6C"],
  ["#f5e3c4", "#7C0124", "#E00800"],
  ["#d9e3ff", "#181F4B", "#7C0124"],
];
const SKINS = ["#f1c9a5", "#d9a37c", "#b9805a", "#8d5a3b", "#e8b98f"];
const SHIRTS = ["#E00800", "#ffffff", "#181F4B", "#47CB6C", "#7C0124", "#D18D86", "#E2E2D7", "#16363A"];

/** A flat-illustration "group selfie" so the wall looks alive without real photos. */
export function samplePhoto(seed: number): string {
  const [sky, sea, accent] = PALETTES[seed % PALETTES.length];
  const people = Array.from({ length: CREW_SIZE }, (_, i) => {
    const row = i < 4 ? 0 : 1;
    const col = i < 4 ? i : i - 4;
    const x = 130 + col * 180 + (row ? 90 : 0);
    const y = row ? 420 : 350;
    const r = row ? 52 : 46;
    const skin = SKINS[(seed + i) % SKINS.length];
    const shirt = SHIRTS[(seed * 3 + i) % SHIRTS.length];
    return (
      `<ellipse cx="${x}" cy="${y + r * 2.1}" rx="${r * 1.25}" ry="${r * 1.3}" fill="${shirt}"/>` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${skin}"/>` +
      `<path d="M${x - r} ${y - 6}a${r} ${r} 0 0 1 ${r * 2} 0c-${r * 0.5} -${r * 0.55} -${r * 1.5} -${r * 0.55} -${r * 2} 0z" fill="#2a1a14"/>` +
      `<circle cx="${x - r * 0.33}" cy="${y + 2}" r="4" fill="#2a1a14"/><circle cx="${x + r * 0.33}" cy="${y + 2}" r="4" fill="#2a1a14"/>` +
      `<path d="M${x - r * 0.4} ${y + r * 0.32}q${r * 0.4} ${r * 0.35} ${r * 0.8} 0" stroke="#2a1a14" stroke-width="4" fill="none" stroke-linecap="round"/>`
    );
  }).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>` +
    `<circle cx="${140 + (seed % 5) * 130}" cy="120" r="64" fill="${accent}" opacity=".9"/>` +
    `<rect y="470" width="800" height="130" fill="${sea}"/>` +
    `<path d="M700 470c0-90-12-170-6-230M694 250c-40-40-90-40-130-10M694 250c40-40 90-40 120-5M694 250c-20-50-70-70-110-50" stroke="#16363A" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    people +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function sampleCrewInput(index: number): CapsuleCrewInput {
  const [leaderName, crewName, answers] = SAMPLE[index % SAMPLE.length];
  const round = Math.floor(index / SAMPLE.length);
  return {
    leaderName,
    crewName: round ? `${crewName} ${round + 1}` : crewName,
    answers: [...answers],
    photo: samplePhoto(index),
  };
}

export const SAMPLE_THEMES: CapsuleThemes = {
  language: "en",
  generatedAt: 0,
  crewCount: 8,
  byQuestion: [
    [
      { theme: "Speed with heart", crews: 4, quote: "We move fast and still care about each other." },
      { theme: "Customers at the centre", crews: 2, quote: "Our customers sit at the centre of every decision." },
      { theme: "Pride in the network", crews: 2, quote: "We keep the network running no matter what." },
    ],
    [
      { theme: "Curious, kind, ready to share", crews: 4, quote: "Anyone curious, kind and ready to share the work." },
      { theme: "Respect for everyone", crews: 3, quote: "People who respect everyone, from the first day." },
      { theme: "Growth mindset", crews: 2, quote: "Everyone who wants to grow and help others grow." },
    ],
    [
      { theme: "Leaving people behind", crews: 3, quote: "Leave a colleague behind when a deadline gets tough." },
      { theme: "Blame and hiding mistakes", crews: 3, quote: "Blame a person before looking at the problem." },
      { theme: "Silos and slow approvals", crews: 2, quote: "Every team on its own little island." },
    ],
    [
      { theme: "People who show up for each other", crews: 5, quote: "Nobody gets left behind." },
      { theme: "Respect and gratitude", crews: 3, quote: "People thank each other and mean it." },
      { theme: "Room to learn and grow", crews: 2, quote: "Learning is part of the job." },
    ],
  ],
};

export const SAMPLE_CONSTITUTION: CapsuleConstitution = {
  language: "en",
  generatedAt: 0,
  crewCount: 8,
  sample: true,
  title: "The One Island Constitution",
  preamble:
    "We, the crews of The One Island, write this together so that everyone who comes after us knows who we are and what we promise each other.",
  articles: [
    {
      heading: "Our identity",
      clauses: [
        "We move fast and still take the time to care about each other.",
        "Our customers sit at the centre of every decision we make.",
        "We keep the network running, and we are proud that it connects millions of families.",
      ],
    },
    {
      heading: "Who can join",
      clauses: [
        "Anyone who is curious, kind and ready to share the work.",
        "Everyone who respects people, from the first day to the last.",
        "Anyone who wants to grow and help others grow.",
      ],
    },
    {
      heading: "Our red lines",
      clauses: [
        "We never leave a colleague behind when a deadline gets tough.",
        "We never blame a person before we look at the problem.",
        "We never let a good idea wait in a chain of approvals, and we never work in silos.",
      ],
    },
    {
      heading: "What we cherish",
      clauses: [
        "People who show up for each other, even on a Friday night.",
        "Respect, and a thank-you that is meant.",
        "The freedom to learn, to ask anyone, and to get a real answer.",
      ],
    },
  ],
  closing: "To whoever leads the island next: protect what we cherish, and hold the red lines.",
  signOff: "Signed by the crews of The One Island",
};
