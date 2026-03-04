import axios from 'axios';

async function run() {
    try {
        const mangaId = "322f11ba-7a9d-4a57-83f5-924b8f6319d6";
        const chRes = await axios.get(`https://api.mangadex.org/chapter?manga=${mangaId}&limit=1&translatedLanguage[]=en`);
        const item = chRes.data.data[0];
        console.log(JSON.stringify(item, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
run();
