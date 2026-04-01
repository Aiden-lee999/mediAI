const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

code = code.replace(/setMessages\(\[\.\.\.newHistory,\s*\{\s*role:\s*'assistant',\s*error:\s*'서버 통신 오류가 발생했습니다\.'\s*\}\]\);/g, "setMessages([...newHistory, { role: 'assistant', error: '서버 통신 오류가 발생했습니다. (' + String(error) + ')' }]);");

fs.writeFileSync('src/app/dashboard/page.tsx', code);
console.log('Patched dashboard page to show err');