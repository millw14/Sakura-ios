// Test AnimePahe airing API
async function test() {
    const res = await fetch('https://animepahe.si/api?m=airing&page=1', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://animepahe.si',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Total items:", data.total);
    console.log("First 3 items:", JSON.stringify(data.data?.slice(0, 3), null, 2));
}
test();
