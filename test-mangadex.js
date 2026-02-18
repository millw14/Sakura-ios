const axios = require('axios');

async function testChapterPages(chapterId) {
    try {
        console.log(`Testing chapter: ${chapterId}`);
        const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
        const response = await axios.get(url);

        console.log("Response status:", response.status);
        console.log("Data structure keys:", Object.keys(response.data));

        if (response.data.baseUrl) {
            console.log("Base URL found:", response.data.baseUrl);
        } else {
            console.error("Base URL MISSING");
        }

        if (response.data.chapter) {
            console.log("Chapter hash:", response.data.chapter.hash);
            console.log("Page count:", response.data.chapter.data.length);
            console.log("First page:", response.data.chapter.data[0]);
        } else {
            console.error("Chapter data MISSING");
        }

    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("API Error data:", error.response.data);
        }
    }
}

// Test with a known chapter ID (e.g. from a popular series like One Piece or similar, or just a random valid one)
// Using a random chapter ID from recent successful tests or a common one. 
// Let's use a known ID. 
// I'll pick a recent chapter ID if I can, or just a random one. 
// Let's try to search for one first, or just use a hardcoded one.
// I'll assume 5e8da928-095a-46c3-997c-d6j8j8j8j8 (fake) won't work.
// I'll search for "One Piece" first to get a valid ID in another script, or just try to hit the search endpoint first.

async function getValidChapterId() {
    try {
        const resp = await axios.get('https://api.mangadex.org/manga?limit=1&title=One%20Piece');
        const mangaId = resp.data.data[0].id;
        const chapResp = await axios.get(`https://api.mangadex.org/chapter?manga=${mangaId}&limit=1`);
        return chapResp.data.data[0].id;
    } catch (e) {
        console.error("Failed to get ID", e.message);
        return null;
    }
}

(async () => {
    const id = await getValidChapterId();
    if (id) {
        await testChapterPages(id);
    }
})();
