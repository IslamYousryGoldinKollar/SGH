import { CREW_SIZE, type CapsuleCrewInput, type CapsuleLetter, type CapsuleThemes } from "./types";

/** Rehearsal content for `/capsule/demo` — clearly sample copy, never real data. */

const SAMPLE: Array<[leader: string, crew: string, answers: [string, string, string]]> = [
  ["Omar", "The Navigators", [
    "People who genuinely show up for each other, even on a Friday night.",
    "We move fast and still take the time to care about each other.",
    "Slow approvals that make good ideas wait for weeks.",
  ]],
  ["Sara", "Sunrise Crew", [
    "The open-door feeling: you can ask anyone, at any level, and get a real answer.",
    "Our customers are at the centre of every decision, not a slide in a deck.",
    "Working in silos: every team on its own little island.",
  ]],
  ["Mohamed", "Palm Pioneers", [
    "Teamwork. Nobody gets left behind when a deadline gets tough.",
    "Pride in the brand: we know the network connects millions of families.",
    "Meetings that could have been a two-line message.",
  ]],
  ["Nour", "Coral Squad", [
    "Learning is part of the job: we are encouraged to grow.",
    "A mix of experience and fresh energy that actually listens to each other.",
    "Fear of making mistakes. We should learn out loud instead.",
  ]],
  ["Karim", "The Tidal Wave", [
    "Respect: people thank each other and mean it.",
    "We solve problems together instead of looking for who to blame.",
    "Unclear ownership. Too many people responsible means nobody is.",
  ]],
  ["Hana", "Lagoon Legends", [
    "The family spirit: colleagues become friends.",
    "Resilience. We keep the network running no matter what.",
    "Last-minute urgent requests with no context.",
  ]],
  ["Youssef", "North Coast Navigators", [
    "Support from managers who listen before they decide.",
    "Big-company stability with a start-up appetite for new ideas.",
    "Duplicated reports that nobody reads.",
  ]],
  ["Mariam", "Seashell Society", [
    "Diversity of people and backgrounds, all under one brand.",
    "We celebrate wins together, big or small.",
    "The 'that's not my department' reflex.",
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
      { theme: "People who show up for each other", crews: 5, quote: "Nobody gets left behind when a deadline gets tough." },
      { theme: "Respect and openness", crews: 3, quote: "You can ask anyone, at any level, and get a real answer." },
      { theme: "Room to learn and grow", crews: 2, quote: "Learning is part of the job." },
    ],
    [
      { theme: "Speed with heart", crews: 4, quote: "We move fast and still care about each other." },
      { theme: "Customers at the centre", crews: 3, quote: "Our customers are at the centre of every decision." },
      { theme: "Pride in the network", crews: 2, quote: "We keep the network running no matter what." },
    ],
    [
      { theme: "Slow approvals", crews: 3, quote: "Good ideas wait for weeks." },
      { theme: "Silos and unclear ownership", crews: 3, quote: "Every team on its own little island." },
      { theme: "Fear of mistakes", crews: 2, quote: "We should learn out loud instead." },
    ],
  ],
};

export const SAMPLE_LETTER: CapsuleLetter = {
  language: "en",
  generatedAt: 0,
  crewCount: 8,
  sample: true,
  title: "A letter to the future managers of e&",
  salutation: "Dear future managers,",
  opening:
    "We wrote this together, in crews of eight, on an island, with sand on our shoes. It is what we wish someone had told us on our first day.",
  sections: [
    {
      heading: "What e& is",
      body:
        "e& is people who keep millions of families connected, and who keep each other connected while doing it. Behind every network, every app and every call is a colleague who answered the phone on a bad night.",
    },
    {
      heading: "What defines our culture",
      body:
        "We show up for each other. We move fast and still care. We put the customer at the centre of the decision, and we can ask anyone, at any level, for a straight answer.",
    },
    {
      heading: "What you need to do to keep it unique and successful",
      body: "Protect what we love, and have the courage to remove what slows us down.",
      bullets: [
        "Listen before you decide, and say thank you out loud.",
        "Give decisions a clear owner and a short approval path.",
        "Break the silos: one company, one destination.",
        "Make it safe to make mistakes and learn out loud.",
      ],
    },
  ],
  closing: "Look after the people. The rest follows.",
  signOff: "With pride, the crews of The One Island",
};
