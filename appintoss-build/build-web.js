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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="https://kadeora.app/feed?toss=1" allow="clipboard-write"></iframe>
</body>
</html>`);

console.log('Web build done');
