const puppeteer = require('d:/ocean/osp_backend/node_modules/puppeteer-extra');
const StealthPlugin = require('d:/ocean/osp_backend/node_modules/puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

/**
 * Launch a visible browser for the user to login to Google manually,
 * then capture the session cookies automatically.
 */
(async () => {
  console.log('=== Google Cookie Capture Tool ===');
  console.log('This will open a Chrome window.');
  console.log('1. Sign in to Google in the browser that opens');
  console.log('2. Navigate to Google Maps');
  console.log('3. After you are signed in, press ENTER in this terminal to capture cookies\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
      '--start-maximized',
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2' });
  
  console.log('Browser opened. Please sign in to Google...');
  console.log('After signing in and navigating to maps.google.com, press ENTER here to capture cookies.');
  
  // Wait for ENTER key
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Navigate to Google Maps and capture cookies
  await page.goto('https://www.google.com/maps', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const cookies = await page.cookies('https://www.google.com');
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  console.log(`\nCaptured ${cookies.length} cookies`);
  
  // Save to env file
  const cookieFile = 'd:/ocean/osp_backend/.google-cookies';
  fs.writeFileSync(cookieFile, cookieStr, 'utf8');
  console.log(`Cookies saved to: ${cookieFile}`);
  
  // Also print them
  console.log('\nImportant cookies:');
  cookies.filter(c => ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PAPISID', '__Secure-3PAPISID', 'NID'].includes(c.name))
    .forEach(c => console.log(`  ${c.name}=${c.value.slice(0, 40)}...`));
  
  await browser.close();
  console.log('\nDone! Cookies saved. Now run the sync.');
})();
