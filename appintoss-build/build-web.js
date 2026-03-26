const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

fs.writeFileSync(path.join(dist, 'index.html'), `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>카더라</title>
  <script>window.location.replace('https://kadeora.app/feed?toss=1');</script>
</head>
<body></body>
</html>`);

console.log('Web build done');
