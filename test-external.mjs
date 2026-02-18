import axios from 'axios';

// One Piece Chapter 1100 (MangaPlus) - Likely external
// I need to find a real ID first. 
async function findExternalChapter() {
    try {
        // Search for Chainsaw Man
        const searchRes = await axios.get('https://api.mangadex.org/manga?title=Chainsaw%20Man&limit=1');
        const mangaId = searchRes.data.data[0].id;

        // Get chapters
        const chapRes = await axios.get(`https://api.mangadex.org/chapter?manga=${mangaId}&limit=100&translatedLanguage[]=en`);

        const total = chapRes.data.data.length;
        const external = chapRes.data.data.filter(ch => ch.attributes.externalUrl !== null).length;
        const internal = total - external;

        console.log(`Total fetched: ${total}`);
        console.log(`External (MangaPlus etc): ${external}`);
        console.log(`Internal (Hosted on MangaDex): ${internal}`);

        return null;

    } catch (e) {
        console.error("Setup failed:", e.message);
        return null;
    }
}

async function testAtHome(chapterId) {
    try {
        console.log(`Testing @home for ${chapterId}...`);
        const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
        const response = await axios.get(url);
        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("Error fetching @home:", e.message);
        if (e.response) {
            console.log("Response Data:", e.response.data);
        }
    }
}

(async () => {
    const id = await findExternalChapter();
    if (id) {
        await testAtHome(id);
    }
})();
