import * as cheerio from 'cheerio';

const BASE_URL = 'https://anitaku.bz';
const AJAX_URL = 'https://ajax.gogocdn.net/ajax';

async function test() {
    console.log("Searching for 'naruto'...");
    const res = await fetch(`${BASE_URL}/search.html?keyword=naruto`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const items = $('.items li .name a').map((_, el) => ({
        id: $(el).attr('href')?.replace('/category/', ''),
        title: $(el).attr('title') || $(el).text()
    })).get();

    console.log("Search Results:", items.slice(0, 3));

    if (!items.length) return;

    const firstId = items[0].id;
    console.log(`\nFetching Info for: ${firstId}...`);

    const infoRes = await fetch(`${BASE_URL}/category/${firstId}`);
    const infoHtml = await infoRes.text();
    const $info = cheerio.load(infoHtml);

    const movieId = $info('#movie_id').val();
    const alias = $info('#alias_anime').val();
    const epStart = '0';
    let epEnd = $info('#episode_page a.active').attr('ep_end') || '1000';

    // Find max epEnd from paginator
    $info('#episode_page a').each((_, el) => {
        const end = $info(el).attr('ep_end');
        if (end && parseInt(end) > parseInt(epEnd)) {
            epEnd = end;
        }
    });

    console.log(`Movie ID: ${movieId}, Alias: ${alias}, EpEnd: ${epEnd}`);

    console.log('\nFetching Episodes...');
    const epsRes = await fetch(`${AJAX_URL}/load-list-episode?ep_start=${epStart}&ep_end=${epEnd}&id=${movieId}&default_ep=0&alias=${alias}`);
    const epsHtml = await epsRes.text();
    const $eps = cheerio.load(epsHtml);

    const eps = $eps('li a').map((_, el) => ({
        id: $eps(el).attr('href')?.trim().replace('/', ''),
        num: $eps(el).find('.name').text().replace('EP', '').trim(),
    })).get().reverse();

    console.log(`Found ${eps.length} episodes. First 3:`, eps.slice(0, 3));

    if (!eps.length) return;

    const epId = eps[0].id;
    console.log(`\nFetching Episode Page for ${epId}...`);

    const epRes = await fetch(`${BASE_URL}/${epId}`);
    const epPageHtml = await epRes.text();
    const $epPage = cheerio.load(epPageHtml);

    const iframeUrl = $epPage('.play-video iframe').attr('src');
    console.log('IFrame URL:', iframeUrl);
}

test().catch(console.error);
