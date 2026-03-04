import axios from 'axios';

async function fetchPlaceholder() {
    try {
        const pRes = await axios.get('https://mangadex.org/images/misc/placeholder.png', {
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(pRes.data);
        if (buffer.toString('ascii', 12, 16) === 'IHDR') {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            console.log(`Dimensions: ${width}x${height}`);
        } else {
            console.log('Not a valid PNG or IHDR chunk missing.');
        }
    } catch (e) {
        console.error(e.message);
    }
}
fetchPlaceholder();
