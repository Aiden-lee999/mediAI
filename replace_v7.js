const fs = require("fs");
let file = fs.readFileSync("src/app/api/ask/route.ts", "utf8");

file = file.replace("if (msg.role === \"assistant\" && msg.parsedData) {\n            msgContent = typeof msg.parsedData === \"string\" ? msg.parsedData : JSON.stringify(msg.parsedData);\n        }", 
`if (msg.role === "assistant" && msg.parsedData) {
            msgContent = typeof msg.parsedData === "string" ? msg.parsedData : (msg.parsedData.chat_reply || "AI 응답 요약");
        }`);

file = file.replace(/\\\/\* 반드시 10개 이상 작성할 것 \\\*\//g, "");

file = file.replace(`{ "name": "[실제약물명1]", "ingredient": "[성분명1]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" }, { "name": "[실제약물명2]", "ingredient": "[성분명2]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" }`, `{ "name": "[실제약물명1]", "ingredient": "[성분명1]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" } , { "name": "[실제약물명2]", "ingredient": "[성분명]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" }`);

fs.writeFileSync("src/app/api/ask/route.ts", file);

