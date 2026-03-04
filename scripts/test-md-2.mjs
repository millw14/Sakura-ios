import axios from 'axios';

async function fetchPlaceholder() {
    try {
        // Many MangaDex nodes return this exact URL for hotlink placeholders. 
        // We will hit a MangaDex chapter to see what it returns with a bad referer.
        const res = await axios.get('https://mangadex.org/img/avatar.png', {
            responseType: 'arraybuffer'
        });
        console.log("Avatar Length:", res.data.length);

        // Let's try fetching the placeholder directly if we know its URL
        const pRes = await axios.get('https://mangadex.org/images/misc/placeholder.png', {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });
        console.log("Placeholder status:", pRes.status);
        if (pRes.status === 200) {
            console.log("Placeholder Length:", pRes.data.length);
        }
    } catch (e) {
        console.error(e.message);
    }
}
fetchPlaceholder();
