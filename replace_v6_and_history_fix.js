const fs = require("fs");
const newPrompt = fs.readFileSync("e:/mediAI/new_prompt_v6.txt", "utf8");
let files = ["src/app/api/ask/route.ts", "backend/src/routes/chatRoutes.ts"];

files.forEach(f => {
  let file = fs.readFileSync(f, "utf8");
  
  // 1. 프롬프트 교체
  let firstPart = file.split("content: `당신은")[0];
  let secondPart = file.split("  \"blocks\": [")[1].split("]\n}\n`")[1];
  let newFile = firstPart + "content: `" + newPrompt + "\n`" + secondPart;
  
  // 2. 히스토리 버그 교체 (프론트에서 assistant가 parsedData로 오기 때문에 content가 undefined가 되는 버그 방어)
  newFile = newFile.replace(`
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      });
    }
`, `
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        let msgContent = msg.content;
        if (msg.role === "assistant" && msg.parsedData) {
            msgContent = typeof msg.parsedData === "string" ? msg.parsedData : JSON.stringify(msg.parsedData);
        }
        if (msgContent) {
            messages.push({
              role: msg.role === "user" ? "user" : "assistant",
              content: typeof msgContent === "string" ? msgContent : JSON.stringify(msgContent)
            });
        }
      });
    }
`);

  fs.writeFileSync(f, newFile, "utf8");
});

