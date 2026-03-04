import CryptoJS from 'crypto-js';

const KEY = "3709ad8892f413166b796a10c7fb86018bd1be1c7ae6f4d2cfc3fdc299cb3205";

async function test() {
    try {
        console.log("Fetching encrypted Megacloud payload...");
        const srcRes = await fetch('https://megacloud.tv/embed-2/ajax/e-1/getSources?id=XQHKB132Cmag', {
            headers: {
                'Referer': 'https://hianime.to/',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });

        const data = await srcRes.json();
        const encryptedSources = data.sources;

        console.log("Cipher text length:", encryptedSources.length);

        // Use CryptoJS to decrypt the AES ciphertext
        console.log("Decrypting with key...");

        // Typically megacloud uses a simple AES encryption with the key string
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedSources, KEY);
        const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted Text length:", decryptedText.length);

        if (decryptedText.length > 0) {
            console.log("Parsed Array:", JSON.parse(decryptedText));
        } else {
            console.log("Decryption resulted in empty string. Key might be wrong or format requires Salt/IV explicitly.");
        }

    } catch (e) {
        console.error("Test failed", e);
    }
}

test();
