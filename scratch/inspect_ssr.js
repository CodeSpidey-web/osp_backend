const https = require('https');

https.get('https://www.oceanstudentprojects.com/', (res) => {
  let html = '';
  res.on('data', (chunk) => html += chunk);
  res.on('end', () => {
    // Search for image-proxy references
    const idx = html.indexOf('image-proxy');
    if (idx !== -1) {
      console.log('Found image-proxy reference:');
      console.log(html.substring(idx - 150, idx + 350));
    } else {
      console.log('No image-proxy references found in SSR HTML!');
      // Check if popular categories section exists
      const catIdx = html.indexOf('rbt-catagories-area');
      if (catIdx !== -1) {
        console.log('Found rbt-catagories-area section:');
        console.log(html.substring(catIdx - 200, catIdx + 800));
      } else {
        console.log('rbt-catagories-area section not found!');
      }
    }
  });
}).on('error', (err) => {
  console.error(err);
});
