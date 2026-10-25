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
      const parsed = JSON.parse(raw);
      const graph = parsed['@graph'] || [];
      for (const item of graph) {
        console.log('Item type:', item['@type']);
        if (item['@type'] === 'ItemList') {
          console.log('  ItemList has itemListElement:', Array.isArray(item.itemListElement));
          if (item.itemListElement) {
            for (const listItem of item.itemListElement) {
              console.log('  ListItem.item:', listItem.item['@type'], listItem.item.name, listItem.item.url);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
