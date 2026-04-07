const fs = require('fs');

const files = [
  'src/components/drug/DrugSearchPanel.tsx',
  'src/app/dashboard/page.tsx',
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/const\s+(\w+)\s*=\s*await\s+res\.json\(\);/g, (match, varName) => {
      return const __text = await res.text(); let \; try { \ = JSON.parse(__text); } catch (err) { throw new Error('API Response Error: ' + __text.substring(0, 100)); };
    });
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed', f);
  }
});
