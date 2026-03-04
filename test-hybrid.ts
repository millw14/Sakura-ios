import { fetchAnimeInfo, searchAnime, fetchAiringAnime } from "./src/lib/anime";

async function test() {
    console.log("--- TEST AIRING ---");
    const airing = await fetchAiringAnime();
    console.log("Airing Output:", airing.slice(0, 2));

    console.log("\n--- TEST SEARCH ---");
    const res = await searchAnime("Naruto");
    console.log("Search Output:", res.slice(0, 2));

    const firstMalId = res[0].id;
    console.log(`\n--- TEST INFO (MAL ID: ${firstMalId}) ---`);
    const info = await fetchAnimeInfo(firstMalId);
    console.log("Info Output:");
    console.log(`Title: ${info?.title}`);
    console.log(`Description: ${info?.description?.substring(0, 50)}...`);
    console.log(`Episodes mapped: ${info?.episodes?.length}`);
    if (info?.episodes?.length) {
        console.log("First episode ID:", info.episodes[0].id);
    }
}
test();
