import axios from 'axios';
import https from 'https';

function fetchRaw(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                data: Buffer.concat(chunks)
            }));
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log("Searching for Bilibili Comics group on MangaDex...");
        // Bilibili Comics official group ID on MangaDex was known for having all its chapters replaced by a placeholder when it went down.
        // Let's just search for any manga and fetch chapter 1, then check if we can find a known placeholder.
        // Even better, let's search for "Heaven Official's Blessing"
        const searchRes = await axios.get("https://api.mangadex.org/manga?title=Heaven Official's Blessing&limit=1");
        const mangaId = searchRes.data.data[0].id;

        console.log("Fetching chapters for", mangaId);
        const chRes = await axios.get(`https://api.mangadex.org/chapter?manga=${mangaId}&limit=10&translatedLanguage[]=en`);
        const chId = chRes.data.data[0].id;

        console.log("Fetching at-home for chapter", chId);
        const atHomeRes = await axios.get("https://api.mangadex.org/at-home/server/" + chId);
        const atHomeData = atHomeRes.data;

        const imgUrl = `${atHomeData.baseUrl}/data/${atHomeData.chapter.hash}/${atHomeData.chapter.data[0]}`;
        console.log("Fetching image:", imgUrl);

        const imgRes = await fetchRaw(imgUrl);
        const buf = imgRes.data;

        console.log("Length:", buf.length);
        if (buf.toString('ascii', 6, 10).toUpperCase() === 'JFIF' || buf[0] === 0xFF && buf[1] === 0xD8) {
            console.log("Returned a JPEG");
            // Basic JPEG dimension parsing
            let i = 2;
            while (i < buf.length) {
                let marker = buf[i];
                let marker2 = buf[i + 1];
                if (marker !== 0xFF) break;
                if (marker2 === 0xC0 || marker2 === 0xC2) {
                    let h = buf.readUInt16BE(i + 5);
                    let w = buf.readUInt16BE(i + 7);
                    console.log(`JPEG Dimensions: ${w}x${h}`);
                    break;
                }
                i += 2 + buf.readUInt16BE(i + 2);
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}
run();
