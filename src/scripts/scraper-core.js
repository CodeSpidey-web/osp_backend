const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Scrapes Google reviews for a specific placeId or locationUrl.
 * @param {Object} options
 * @param {string} [options.placeId]
 * @param {string} [options.locationUrl]
 * @param {string} [options.locationName]
 * @returns {Promise<Array<Object>>} Extracted reviews
 */
async function scrapeGoogleReviews({ placeId, locationUrl, locationName }) {
  console.log(`[Scraper] Starting scrape for Place ID: ${placeId || 'N/A'}, URL: ${locationUrl || 'N/A'}, Name: ${locationName || 'N/A'}`);

  let targetUrl = '';
  if (locationUrl && locationUrl.trim() !== '') {
    targetUrl = locationUrl.trim();
    if (targetUrl.includes('/local/writereview')) {
      targetUrl = targetUrl.replace('/local/writereview', '/local/reviews');
    }
  } else if (placeId && placeId.trim() !== '') {
    targetUrl = `https://www.google.com/maps/place/?q=place_id:${placeId.trim()}`;
  } else {
    throw new Error('Neither locationUrl nor placeId was provided.');
  }

  // Ensure language is English
  if (!targetUrl.includes('hl=')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'hl=en';
  }

  // Ensure reviews view parameters (!9m1!1b1) are present if on maps/place URL
  if (targetUrl.includes('/maps/place/') && !targetUrl.includes('!9m1!1b1')) {
    if (targetUrl.includes('data=')) {
      targetUrl = targetUrl.replace(/data=([^&]+)/, 'data=$1!9m1!1b1');
    } else if (targetUrl.includes('?')) {
      targetUrl = targetUrl.replace('?', '?data=!9m1!1b1&');
    }
  }

  console.log(`[Scraper] Navigating to: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,1000',
      '--lang=en-US',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1000 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // 1. Navigate to Google Maps Reviews Page
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // 2. Handle Cookie Consent if present
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, form button'));
      for (const btn of buttons) {
        const txt = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
        if (txt.includes('accept all') || txt.includes('agree') || txt.includes('stimm') || txt.includes('akzeptieren')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Fallback attempt: Click Reviews tab if cards are not immediately visible
    let cardCount = await page.evaluate(() => document.querySelectorAll('div[data-review-id]').length);
    if (cardCount === 0) {
      console.log('[Scraper] Reviews cards not immediately visible. Attempting tab click fallback...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"], button'));
        for (const tab of tabs) {
          const text = (tab.textContent || '').trim().toLowerCase();
          const ariaLabel = (tab.getAttribute('aria-label') || '').toLowerCase();
          if (text === 'reviews' || text.includes('reviews') || ariaLabel.includes('reviews')) {
            tab.click();
            return;
          }
        }
      });
      await new Promise(r => setTimeout(r, 4000));
    }

    // 4. Wait for review cards selector
    console.log('[Scraper] Waiting for review cards (div[data-review-id])...');
    try {
      await page.waitForSelector('div[data-review-id]', { timeout: 10000 });
    } catch (err) {
      console.log('[Scraper] Warning: div[data-review-id] timeout. Attempting to scrape existing DOM.');
    }

    // 5. Scroll container to load all reviews
    console.log('[Scraper] Starting scroll loop...');
    await page.evaluate(async () => {
      const getScrollableElement = () => {
        const divs = Array.from(document.querySelectorAll('div'));
        for (const div of divs) {
          const style = window.getComputedStyle(div);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight) {
            if (div.getBoundingClientRect().width > 0) return div;
          }
        }
        return document.scrollingElement || document.documentElement || document.body;
      };

      const container = getScrollableElement();
      let lastHeight = container.scrollHeight;
      let attempts = 0;
      let scrollsCount = 0;

      while (attempts < 5 && scrollsCount < 50) {
        container.scrollTop = container.scrollHeight;
        scrollsCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));

        const newHeight = container.scrollHeight;
        if (newHeight === lastHeight) {
          attempts++;
        } else {
          lastHeight = newHeight;
          attempts = 0;
        }
      }
    });

    // Expand "More" buttons
    await page.evaluate(() => {
      const moreButtons = Array.from(document.querySelectorAll('button, span')).filter(el => {
        const txt = el.textContent ? el.textContent.trim().toLowerCase() : '';
        return txt === 'more' || txt === 'see more' || el.className.includes('more-button') || el.getAttribute('aria-label') === 'See more';
      });
      for (const btn of moreButtons) {
        try { btn.click(); } catch (e) {}
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // 6. Extract data
    console.log('[Scraper] Extracting reviews list...');
    const reviews = await page.evaluate(() => {
      const reviewElements = Array.from(document.querySelectorAll('div[data-review-id]'));
      const seen = new Set();

      return reviewElements.map((el) => {
        const reviewId = el.getAttribute('data-review-id') || '';

        // Author Name
        let authorName = '';
        const authorEl = el.querySelector('.d4r55, .TSq7ee, [class*="name"], [class*="title"]');
        if (authorEl) {
          authorName = authorEl.textContent ? authorEl.textContent.trim() : '';
        } else {
          const bold = el.querySelector('strong, b');
          if (bold) authorName = bold.textContent.trim();
        }

        // Rating
        let rating = 5;
        const ratingEl = el.querySelector('[aria-label*="star" i], [aria-label*="stars" i]');
        if (ratingEl) {
          const ariaLabel = ratingEl.getAttribute('aria-label');
          const match = ariaLabel ? ariaLabel.match(/(\d)/) : null;
          if (match) {
            rating = parseInt(match[1], 10);
          }
        }

        // Review Text
        let reviewText = '';
        const textSelectors = ['.wiI7pd', '.My5gG', '.JruOW', 'span[class*="text" i]'];
        for (const selector of textSelectors) {
          const textEl = el.querySelector(selector);
          if (textEl && textEl.textContent.trim() !== '') {
            reviewText = textEl.textContent.trim();
            break;
          }
        }

        // Review Date
        let reviewDate = '';
        const dateEl = el.querySelector('span.rsqaWe, span.rsqawe, .xpc6ce, span[class*="date" i]');
        if (dateEl) {
          reviewDate = dateEl.textContent ? dateEl.textContent.trim() : '';
        }

        // Profile Photo URL
        let profilePhotoUrl = '';
        const imgEl = el.querySelector('img[src*="googleusercontent.com"], img');
        if (imgEl) {
          profilePhotoUrl = imgEl.src || '';
        }

        // Review Link
        let reviewUrl = '';
        const linkEl = el.querySelector('button[data-href], a[href*="reviews" i], a[href*="contrib" i]');
        if (linkEl) {
          reviewUrl = linkEl.getAttribute('data-href') || linkEl.href || '';
        }

        return {
          reviewId,
          authorName,
          rating,
          reviewText,
          reviewDate,
          profilePhotoUrl,
          reviewUrl,
        };
      }).filter(r => {
        if (!r.authorName || r.authorName.trim().length === 0) return false;
        // Deduplicate elements with identical ID
        if (seen.has(r.reviewId + r.authorName)) return false;
        seen.add(r.reviewId + r.authorName);
        return true;
      });
    });

    console.log(`[Scraper] Extracted ${reviews.length} reviews successfully.`);
    return reviews;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeGoogleReviews };
