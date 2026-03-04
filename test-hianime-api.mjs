async function test() {
    const urls = [
        "https://hianime-api.vercel.app/api/v2/hianime/home",
        "https://aniwatch-api-net.vercel.app/anime/home",
        "https://api.consumet.org/anime/zoro/naruto",
        "https://api-consumet-org-production.up.railway.app/anime/zoro/naruto"
    ];

    for (const u of urls) {
        try {
            console.log("Testing:", u);
            const r = await fetch(u);
            console.log("  Status:", r.status);
            if (r.ok) {
                const data = await r.json();
                console.log("  Success!", Object.keys(data));
                return; // Stop if we find a working one
            }
        } catch (e) {
            console.log("  Failed:", e.message);
        }
    }
}
test();
