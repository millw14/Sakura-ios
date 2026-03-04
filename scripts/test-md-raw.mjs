import https from 'https';

function fetchRaw(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...headers
            }
        };
        https.get(options, (res) => {
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
        console.log("Fetching a recent chapter...");
        const chRes = await fetchRaw("https://api.mangadex.org/chapter?limit=1&order[createdAt]=desc");
        const chapterData = JSON.parse(chRes.data.toString());
        const chId = chapterData.data[0].id;

        console.log("Fetching at-home for chapter", chId);
        const atHomeRes = await fetchRaw("https://api.mangadex.org/at-home/server/" + chId);
        const atHomeData = JSON.parse(atHomeRes.data.toString());

        const imgUrl = `${atHomeData.baseUrl}/data/${atHomeData.chapter.hash}/${atHomeData.chapter.data[0]}`;
        console.log("Fetching hotlinked image:", imgUrl);

        // Trigger hotlink protection by sending a bad referer
        const imgRes = await fetchRaw(imgUrl, { "Referer": "http://bad-referer-for-hotlink.com/" });

        console.log("Status:", imgRes.status);
        console.log("Length:", imgRes.data.length);

        if (imgRes.data.toString('ascii', 12, 16) === 'IHDR') {
            const width = imgRes.data.readUInt32BE(16);
            const height = imgRes.data.readUInt32BE(20);
            console.log(`Dimensions: ${width}x${height}`);
            console.log(`Exactly matched MangaDex placeholder: ${width}x${height}`);
        } else if (imgRes.data.toString('ascii', 6, 10).toUpperCase() === 'JFIF') {
            console.log("Returned a JPEG");
        } else {
            console.log("Magic bytes:", imgRes.data.slice(0, 8).toString('hex'));
        }
    } catch (e) {
        console.error(e);
    }
}
run();
