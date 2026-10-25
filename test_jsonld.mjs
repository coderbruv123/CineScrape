import axios from 'axios';
import * as cheerio from 'cheerio';

(async () => {
  try {
    const { data } = await axios.get('https://www.thefilmnepal.com/cinemas');
    const $ = cheerio.load(data);
    const $scripts = $('script[type="application/ld+json"]');
    console.log('Number of JSON-LD script tags:', $scripts.length);
    if ($scripts.length > 0) {
      const raw = $scripts.eq(0).html();
      console.log('Raw JSON-LD length:', raw ? raw.length : 0);
      if (raw) {
        const parsed = JSON.parse(raw);
        const graph = parsed['@graph'] || [];
        console.log('Graph size:', graph.length);
        console.log('First item type:', graph[0]['@type']);
      }
    } else {
      console.log('No JSON-LD script tags found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
