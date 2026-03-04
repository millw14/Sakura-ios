async function test() {
    console.log("Testing search...");
    const s = await fetch('https://api-anime-rouge.vercel.app/aniwatch/search?keyword=naruto');
    const sData = await s.json();
    console.log("Search keys:", Object.keys(sData));
    const firstId = sData.animes?.[0]?.id || sData.results?.[0]?.id || sData.anime?.[0]?.id;
    console.log("First Anime ID:", firstId);

    if (!firstId) return;

    console.log("\nTesting episodes...");
    const e = await fetch(`https://api-anime-rouge.vercel.app/aniwatch/episodes/${firstId}`);
    const eData = await e.json();
    console.log("Episodes keys:", Object.keys(eData));
    const firstEpId = eData.episodes?.[0]?.episodeId;
    console.log("First Ep ID:", firstEpId);

    if (!firstEpId) return;

    console.log("\nTesting servers...");
    const srv = await fetch(`https://api-anime-rouge.vercel.app/aniwatch/servers?episodeId=${firstEpId}`);
    const srvData = await srv.json();
    console.log("Servers output:", JSON.stringify(srvData).substring(0, 100));

    // Try fetching sources using the episodeId directly (standard for aniwatch-api)
    console.log("\nTesting sources fallback...");
    const src = await fetch(`https://api-anime-rouge.vercel.app/aniwatch/episode/sources?animeEpisodeId=${firstEpId}`);
    console.log("Sources Status:", src.status);
    const srcData = await src.json();
    console.log("Sources Sample:", JSON.stringify(srcData).substring(0, 200));
}
test();
