import axios from 'axios';

async function testChapterPages(chapterId) {
    try {
        console.log(`Testing chapter: ${chapterId}`);
        const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
        const response = await axios.get(url);

        console.log("Response status:", response.status);

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

// Hardcoded valid chapter ID to test the structure explicitly
const KNOWN_VALID_ID = "49bc73fa-8faa-48e8-bf5b-6901aefa8d25"; // A chapter found in previous logs

async function getValidChapterId() {
    try {
        const resp = await axios.get('https://api.mangadex.org/manga?limit=1&title=One%20Piece');
        const mangaId = resp.data.data[0].id;
        console.log("Manga ID:", mangaId);

        const chapResp = await axios.get(`https://api.mangadex.org/chapter?manga=${mangaId}&limit=1&translatedLanguage[]=en`);
        if (chapResp.data.data.length === 0) {
            console.error("No valid chapters found for this manga.");
            return null;
        }
        return chapResp.data.data[0].id;
    } catch (error) {
        console.error("Failed to get ID:", error.message);
        return null;
    }
}

(async () => {
    await testChapterPages(KNOWN_VALID_ID);
})();
