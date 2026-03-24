const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');
const blockStart = content.indexOf('blocks.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach(block => {');
const blockEnd = content.indexOf('// 만약 data에 그냥 chat_reply만 들어왔을때 방어용');
if(blockStart !== -1 && blockEnd !== -1) {
  console.log('Found block render boundaries.');
} else {
  console.log('Could not find boundaries.', blockStart, blockEnd);
}
