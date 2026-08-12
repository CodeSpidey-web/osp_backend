const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to homepage...');
    await page.goto('https://www.oceanstudentprojects.com/', { waitUntil: 'networkidle2' });
    
    console.log('Extracting popular categories section HTML...');
    const html = await page.evaluate(() => {
      const section = document.querySelector('.rbt-catagories-area');
      return section ? section.innerHTML : 'Section not found';
    });
    
    console.log('HTML Output:\n', html);
  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await browser.close();
  }
})();
