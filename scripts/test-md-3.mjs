import axios from 'axios';
import sizeOf from 'image-size';
import { Buffer } from 'buffer';

async function fetchPlaceholder() {
    try {
        const pRes = await axios.get('https://mangadex.org/images/misc/placeholder.png', {
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(pRes.data);
        const dimensions = sizeOf(buffer);
        console.log("Placeholder Dimensions:", dimensions.width, "x", dimensions.height);
        console.log("Placeholder Length:", buffer.length);
    } catch (e) {
        console.error(e.message);
    }
}
fetchPlaceholder();
