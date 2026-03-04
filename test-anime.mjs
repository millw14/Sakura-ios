import { ANIME } from '@consumet/extensions';

async function testProvider(ProviderClass, name) {
    try {
        console.log(`\n--- Testing ${name} ---`);
        const provider = new ProviderClass();
        const results = await provider.search("Naruto");
        if (results.results && results.results.length > 0) {
            console.log(`Found: ${results.results[0].title} (ID: ${results.results[0].id})`);
            const info = await provider.fetchAnimeInfo(results.results[0].id);
            console.log(`Anime Info: ${info.title} | Episodes: ${info.episodes?.length}`);

            if (info.episodes && info.episodes.length > 0) {
                console.log(`Fetching streaming links for Episode 1 (ID: ${info.episodes[0].id})...`);
                const links = await provider.fetchEpisodeSources(info.episodes[0].id);
                console.log(`Streaming Links found: ${links.sources?.length}`);
                if (links.sources && links.sources.length > 0) {
                    console.log("SUCCESS! Link:", links.sources[0].url);
                    return true;
                }
            }
        }
        return false;
    } catch (e) {
        console.error(`${name} failed:`, e.message);
        return false;
    }
}

async function runAll() {
    const providers = [
        { c: ANIME.AnimePahe, n: "AnimePahe" },
        { c: ANIME.Zoro, n: "Zoro" },
        { c: ANIME.Gogoanime, n: "Gogoanime" }
    ];

    for (const p of providers) {
        if (p.c) await testProvider(p.c, p.n);
    }
}

runAll();
