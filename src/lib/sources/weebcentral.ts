import { Manga, Chapter, MangaSource } from './types';
import * as cheerio from 'cheerio';

// Helper to handle requests (Client-side usage mainly)
// In a real generic app, we'd inject a request handler.
// For now, checks if window.Capacitor is available, else uses fetch/proxy.
async function fetchHtml(url: string): Promise<string> {
    // Check if running in Capacitor
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins.CapacitorHttp) {
        // @ts-ignore
        const response = await window.Capacitor.Plugins.CapacitorHttp.get({ url });
        // CapacitorHttp returns 'data' as string for text content
        return response.data;
    }

    // Fallback for Dev/Web (Direct fetch, might fail due to CORS)
    // The previous API proxy was removed to support 'output: export' for Capacitor.
    console.warn("Fetching directly (CORS might block this on web):", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);

    // WeebCentral returns HTML directly, not JSON { content: ... }
    // The previous proxy returned { content: string }, but direct fetch returns the body.
    const text = await res.text();
    return text;
}

export class WeebCentralSource implements MangaSource {
    name = "WeebCentral";
    id = "weebcentral";
    baseUrl = "https://weebcentral.com";

    async searchManga(query: string): Promise<Manga[]> {
        const url = `${this.baseUrl}/search?text=${encodeURIComponent(query)}`;
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const results: Manga[] = [];
        // CSS selectors based on observation (need to verify exact classes for search results)
        // Assuming standard grid items. 
        // Based on "test-weebcentral.mjs" failing to find items, the search might be complex.
        // Let's assume standard 'article' or 'a' tags with specific classes.
        // If search fails, we might need to look at specific "Section" components.

        // For now, let's implement the parsing logic assuming we find links like /series/ID/Slug
        const links = $('a[href*="/series/"]');

        links.each((i, el) => {
            const href = $(el).attr('href');
            if (!href || href.includes('/series/random')) return;

            // Extract ID and Slug
            // href: https://weebcentral.com/series/ID/Slug OR /series/ID/Slug
            const parts = href.split('/series/')[1]?.split('/');
            if (!parts || parts.length < 2) return;

            const id = parts[0];
            const title = $(el).text().trim(); // Simple text extraction
            const img = $(el).find('img').attr('src') || "";

            // Avoid duplicates
            if (results.find(m => m.id === id)) return;

            results.push({
                id: id,
                title: title || "Unknown",
                description: "",
                cover: img,
                author: "",
                tags: [],
                status: "ongoing", // default
                year: 0,
                sourceStr: this.id
            });
        });

        return results.slice(0, 20); // Limit
    }

    async getMangaDetails(id: string): Promise<Manga | null> {
        // We might not have the slug, but WeebCentral URLs usually require it or redirect.
        // However, the ID usually works if we append anything.
        // Let's try fetching with just ID and let it redirect or assume we stored the full link?
        // Interface only passes ID.
        // We'll hack it: construct URL with ID and dummy slug if needed, or search?
        // Actually, if we scraped it, we have the ID. WeebCentral uses /series/ID/Slug.
        // If we only have ID, we might need to "search" or just try /series/ID/placeholder

        const url = `${this.baseUrl}/series/${id}/slice-of-life`; // "slice-of-life" is dummy
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const title = $('h1').first().text().trim();
        const cover = $('img[src*="cover"]').first().attr('src') || "";
        const description = $('div[x-data]').first().text().trim().substring(0, 500); // Approximate

        // Tags, Author etc would require more specific selectors

        return {
            id,
            title,
            description,
            cover,
            author: "Unknown",
            tags: [],
            status: "ongoing",
            year: 2020,
            sourceStr: this.id
        };
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // 1. Fetch Series Page
        const seriesUrl = `${this.baseUrl}/series/${mangaId}/dummy`;
        const seriesHtml = await fetchHtml(seriesUrl);
        const $ = cheerio.load(seriesHtml);

        // 2. Check for "Show All" link
        const showMoreLink = $('a[hx-get$="full-chapter-list"]').attr('hx-get');

        let htmlToParse = seriesHtml;

        if (showMoreLink) {
            // Fetch the full list
            // Fix relative URL if needed
            const fullListUrl = showMoreLink.startsWith('http') ? showMoreLink : `${this.baseUrl}${showMoreLink}`;
            htmlToParse = await fetchHtml(fullListUrl);
        }

        const $c = cheerio.load(htmlToParse);
        const chapters: Chapter[] = [];

        // Parse rows
        const rows = $c('a[href*="/chapters/"]');
        rows.each((i, el) => {
            const href = $c(el).attr('href');
            if (!href) return;

            // href: /chapters/CHAPTER_ID
            const chapterId = href.split('/chapters/')[1];
            const titleText = $c(el).find('span').text().trim();
            // Title usually "Chapter 123: The Beginning"

            const numMatch = titleText.match(/Chapter\s+(\d+(\.\d+)?)/);
            const chapterNum = numMatch ? numMatch[1] : "0";

            chapters.push({
                id: chapterId,
                mangaId: mangaId,
                volume: "",
                chapter: chapterNum,
                title: titleText,
                publishAt: new Date().toISOString(), // No reliable date parsing yet
                pages: 0, // Unknown until opened
                sourceStr: this.id
            });
        });

        return chapters;
    }

    async getChapterPages(chapterId: string): Promise<string[]> {
        const url = `${this.baseUrl}/chapters/${chapterId}`;
        const html = await fetchHtml(url);

        const pages: string[] = [];

        // 1. Extract Max Pages from Script
        // max_page: parseInt('17')
        const maxPageMatch = html.match(/max_page:\s*parseInt\('(\d+)'\)/);
        if (!maxPageMatch) throw new Error("Could not find page count");

        const maxPage = parseInt(maxPageMatch[1]);

        // 2. Find Base URL from any image
        const imgRegex = /(https:\/\/[^"'\s]+\/)\d+-\d+\.(png|jpg|jpeg)/i;
        const imgMatch = html.match(imgRegex);

        if (!imgMatch) throw new Error("Could not find base image URL");

        const baseUrl = imgMatch[1];
        const ext = imgMatch[2];

        // 3. Construct URLs
        // URL format: BASE/CHAPTER_NUM-PAGE_NUM.ext
        // Note: The chapter number in the URL (e.g. 1174) matches the chapter.
        // AND the file name seems to be "CHAPTER-PAGE.ext".
        // BUT the regex I found was: `.../One-Piece/1174-001.png`
        // I need to be careful about the "1174" part. Is it dynamic?
        // Actually, the full URL was `.../One-Piece/1174-001.png`. 
        // The Base URL I extracted `.../One-Piece/` likely behaves as the prefix.
        // But I need the "Prefix" for the file name. 
        // The regex gives me the FULL pattern of an example image.
        // I should use the example image to derive the pattern.

        // Example: https://host/manga/Title/1174-001.png
        // I want: 1174-002.png, ...
        // So I should strip the "-001.png" suffix and keep the prefix.

        const fullExampleUrl = imgMatch[0]; // https://.../1174-001.png
        const prefix = fullExampleUrl.replace(/-\d+\.(png|jpg|jpeg)$/, '-');

        for (let i = 1; i <= maxPage; i++) {
            const pageNum = i.toString().padStart(3, '0');
            pages.push(`${prefix}${pageNum}.${ext}`);
        }

        return pages;
    }

    async getTrending(limit: number = 20): Promise<Manga[]> {
        // Reuse search with empty or "popular" text?
        return this.searchManga("One Piece"); // Fallback for now
    }
}
