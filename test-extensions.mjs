async function test() {
    try {
        const r = await fetch('https://raw.githubusercontent.com/yuzono/anime-repo/repo/index.min.json');
        const data = await r.json();
        const matches = data.filter(e =>
            e.name.toLowerCase().includes('hianime') ||
            e.name.toLowerCase().includes('9anime') ||
            e.name.toLowerCase().includes('aniwave') ||
            e.name.toLowerCase().includes('zoro')
        );
        console.log(JSON.stringify(matches, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
