const fs = require('fs');
let text = fs.readFileSync('e:/mediAI/prisma/schema.prisma', 'utf8');

text = text.replace(/references: \r?\n\[id\]\)\s+status/g, 'references: [id])\n  status');
text = text.replace(/referenc\r?\nes: \[id\]\)\s+role/g, 'references: [id])\n  role');
text = text.replace(/parentM\r?\nessageId\], references: \[id\]\)\s+childMessages/g, 'parentMessageId], references: [id])\n  childMessages');

text = text.replace(/history\s+String\r?\n\s*summaryChat\s+String\?/, 'history     String\n  occupation  String?\n  summaryChat String?');

fs.writeFileSync('e:/mediAI/prisma/schema.prisma', text, 'utf8');
