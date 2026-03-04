import { fetchAnimeInfo } from "./src/lib/anime";

async function test() {
    // Frieren Season 2 MAL ID is 59978 (from previous log)
    // Actually, Jikan returns "Frieren: Beyond Journey's End Season 2"
    console.log("Fetching Frieren...");
    const info = await fetchAnimeInfo("59978"); // Frieren
    console.log("Episodes:", info?.episodes?.length);
    console.log("Info:", info);

    console.log("Fetching One Piece...");
    const op = await fetchAnimeInfo("21");
    console.log("OP Episodes:", op?.episodes?.length);

    console.log("Fetching Naruto...");
    const naruto = await fetchAnimeInfo("20");
    console.log("Naruto Episodes:", naruto?.episodes?.length);
}
test();
