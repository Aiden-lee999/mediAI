const fs = require("fs");
let file = fs.readFileSync("backend/src/routes/chatRoutes.ts", "utf8");

file = file.replace("if (msg.role === \"assistant\" && msg.parsedData) {\n            msgContent = typeof msg.parsedData === \"string\" ? msg.parsedData : JSON.stringify(msg.parsedData);\n        }", 
`if (msg.role === "assistant" && msg.parsedData) {
            msgContent = typeof msg.parsedData === "string" ? msg.parsedData : (msg.parsedData.chat_reply || "AI 응답 요약");
        }`);

fs.writeFileSync("backend/src/routes/chatRoutes.ts", file);

