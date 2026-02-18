import axios from 'axios';
import * as cheerio from 'cheerio';

async function testWeebCentral() {
    try {
        const seriesUrl = 'https://weebcentral.com/series/01J76XY7E9FNDZ1DBBM6PBJPFK/One-Piece';
        console.log(`Fetching Series: ${seriesUrl}`);
        const response = await axios.get(seriesUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        console.log("Status:", response.status);
        const $ = cheerio.load(response.data);
        console.log("Title:", $('h1').first().text().trim());

        // Description
        // Usually implied by structure, logging broad container
        // console.log("Description Container:", $('div[x-data]').first().html()?.substring(0, 200));

        // Chapters
        // Look for links with /chapters/
        const chapterLinks = $('a[href*="/chapters/"]');
        console.log("Chapter links found:", chapterLinks.length);

        if (chapterLinks.length > 0) {
            const firstHref = chapterLinks.first().attr('href');
            console.log("First Chapter href:", firstHref);

            // Fetch Chapter Page
            console.log(`Fetching Chapter: ${firstHref}`);
            const chapRes = await axios.get(firstHref, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const $c = cheerio.load(chapRes.data);

            // Look for scripts containing image data
            const scripts = $c('script');
            scripts.each((i, el) => {
                const content = $c(el).html();
                // Look for "pages", "images", or array of url-like strings
                if (content && (content.includes('01KHBJQF3DTD2AEY1P7P857A25') || content.includes('.png') || content.includes('.jpg'))) {
                    console.log(`Script ${i} content length: ${content.length}`);
                    // Dump a larger chunk to analyze
                    console.log(content.substring(0, 2000));
                }
            });

            // Inspect Series Page again for HTMX/Show More
            // We can't re-fetch here easily without restructuring, so let's just use the previous knowledge
            // that we missed it. I will add a separate block to fetch the series page again 
            // and specifically look for "Show more" or hx-get.

            // Regex search for image URLs
            const html = chapRes.data;
            const imgRegex = /https:\/\/[^"'\s]+\.(png|jpg|jpeg)/gi;
            const matches = html.match(imgRegex);
            if (matches) {
                console.log("Regex found image URLs:", matches.slice(0, 5));
            } else {
                console.log("Regex found no image patterns.");
            }

        }

        // Independent check for Series Page pagination
        console.log("Checking Series Page for Pagination...");
        const seriesHtml = response.data;
        const $s = cheerio.load(seriesHtml);
        const showMore = $s('button[hx-get], a[hx-get], div[hx-get]');
        if (showMore.length > 0) {
            console.log("Found HTMX element:", showMore.first().attr('hx-get'));
            console.log("Element text:", showMore.first().text().trim());
        } else {
            console.log("No HTMX pagination found.");
            // Check for "full-chapter-list"
            const fullList = $s('#full-chapter-list');
            console.log("Full list container:", fullList.length);
        }

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.log("Status:", e.response.status);
        }
    }
}

testWeebCentral();
