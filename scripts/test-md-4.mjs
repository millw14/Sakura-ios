import fs from 'fs';

function readPNGDimensions(filepath) {
    const buffer = fs.readFileSync(filepath);
    // PNG signature is 8 bytes. IHDR chunk starts at byte 8.
    // Length (4), Chunk Type (4), Width (4 at index 16), Height (4 at index 20)
    if (buffer.toString('ascii', 12, 16) === 'IHDR') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        console.log(`Dimensions: ${width}x${height}`);
    } else {
        console.log('Not a valid PNG or IHDR chunk missing.');
    }
}

readPNGDimensions('placeholder.png');
