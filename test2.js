const fs = require('fs');
const appJs = fs.readFileSync('d:/AppImmo/app.js', 'utf8');
const indexHtml = fs.readFileSync('d:/AppImmo/index.html', 'utf8');

const regex = /document\.getElementById\(['\"]([^'\"]+)['\"]\)\.addEventListener/g;
let match;
const missing = [];
while ((match = regex.exec(appJs)) !== null) {
  const id = match[1];
  if (!indexHtml.includes('id=\"' + id + '\"') && !indexHtml.includes('id=\'' + id + '\'')) {
    missing.push(id);
  }
}
console.log('Missing IDs for addEventListener:', missing);
