import axios from 'axios';

async function fetchPlaceholder() {
    try {
        const pRes = await axios.get('https://mangadex.org/images/misc/placeholder.png', {
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(pRes.data);
        console.log("Magic bytes:", buffer.slice(0, 16).toString('hex'));
    } catch (e) {
        console.error(e.message);
    }
}
fetchPlaceholder();
