const https = require('https');

const url = "https://www.oceanstudentprojects.com/api/image-proxy?url=http://140.245.223.92.nip.io:9000/static/1786441531060-bush-game-template-gui-kit.png";

https.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    // Only log the first chunk or preview
    if (data.length === 0) {
      console.log('First chunk length:', chunk.length);
    }
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Total bytes received:', data.length);
  });
}).on('error', (err) => {
  console.error('Error fetching proxy URL:', err.message);
});
