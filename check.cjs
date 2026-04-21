const fs=require('fs'); let code = fs.readFileSync('src/lib/drugPricesCsv.ts', 'utf8'); console.log(code.indexOf('safePriceIdx'));
