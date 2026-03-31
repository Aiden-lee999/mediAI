const fs = require("fs");

const newPrompt = fs.readFileSync("e:/mediAI/new_prompt.txt", "utf8");

let files = ["src/app/api/ask/route.ts", "backend/src/routes/chatRoutes.ts"];

files.forEach(f => {
  let file = fs.readFileSync(f, "utf8");
  let firstPart = file.split("content: `당신은")[0];
  let secondPart = file.split("  \"blocks\": [")[1].split("]\n}\n`")[1];
  let newFile = firstPart + "content: `" + newPrompt + "\n`" + secondPart;
  fs.writeFileSync(f, newFile, "utf8");
});

