import type { AnimeResult, AnimeInfo } from "./anime";

export const PSYOP_ID = "psyopanime";

export const PSYOP_SEARCH_RESULT: AnimeResult = {
    id: PSYOP_ID,
    title: "PsyopAnime: The Series",
    image: "/psyopanime.png",
    type: "PsyopAnime × Sakura",
    score: 9.9,
};

export const PSYOP_INFO: AnimeInfo = {
    id: PSYOP_ID,
    title: "PsyopAnime: The Series",
    image: "/psyopanime.png",
    cover: "/psyopanime.png",
    description:
        "In a hyper-connected world where digital psyops blur the lines between reality and illusion, " +
        "enter the enigmatic hacker collective known as PsyopAnime. Led by the sharp-witted protagonist, " +
        "Neo-Meme Master Akira, this ragtag group of anime avatars wages a covert war against corrupt crypto barons, " +
        "political puppet-masters, and viral pop culture overlords. Armed with AI-generated visuals that twist minds " +
        "and shatter perceptions, they infiltrate social feeds, dropping satirical bombshells disguised as cute chibi " +
        "animations and epic mecha battles. But as their influence grows, so does the backlash — shadowy governments " +
        "deploy counter-psyop drones, forcing Akira and his crew into a high-stakes game of digital cat-and-mouse. " +
        "Will they expose the grand illusion, or become the very memes they wield? Packed with Easter eggs from " +
        "real-world trends, PsyopAnime delivers razor-sharp commentary wrapped in stunning visuals, proving that " +
        "in the age of information warfare, laughter is the ultimate weapon.",
    status: "Ongoing",
    genres: ["Sci-Fi Action", "Psychological Thriller", "Satire"],
    score: 9.9,
    episodes: [],
};

export const PSYOP_STUDIO = "xAI Visions (in collaboration with meme overlords)";

export const PSYOP_CHARACTERS = [
    {
        name: "Akira",
        role: "The Visionary",
        description:
            "A crypto-savvy otaku who codes psyops like fanfiction, always one step ahead with his SOL-fueled gadgets.",
    },
    {
        name: "Luna",
        role: "The Artist",
        description:
            "Master of AI art contests, she turns viral challenges into revolutionary tools, rewarding allies with digital treasures.",
    },
    {
        name: "Shadow Broker",
        role: "The Antagonist",
        description:
            "A mysterious figure pulling strings from the dark web, embodying the satire's real-life inspirations.",
    },
];

export function matchesPsyopQuery(query: string): boolean {
    const q = query.toLowerCase().trim();
    return (
        q.includes("psyop") ||
        q.includes("neo-meme") ||
        q.includes("psyopanime") ||
        q === "sakura original"
    );
}
