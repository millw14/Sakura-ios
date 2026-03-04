import axios from 'axios';

async function run() {
    try {
        const url = 'https://uploads.mangadex.org/data/b8c1ef4be20b60e6e7d69dd78631b012/1-443fb726ed1654eb68dc3b56a1b80bf608311be9adace491becc94ca0eefe5a2.png';
        const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'Referer': 'http://localhost:3000/' } });
        console.log("Length:", res.data.length);
        console.log("First bytes:", Array.from(new Uint8Array(res.data.slice(0, 10))));
    } catch (e) {
        console.error(e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Length:", e.response.data?.length);
        }
    }
}
run();
