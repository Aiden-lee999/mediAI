const fs = require("fs");
let files = ["src/app/api/ask/route.ts", "backend/src/routes/chatRoutes.ts"];
let END_STRING = `
    });

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      });
    }

    const userMessage: any = { role: "user", content: [] };
    if (question) {
      userMessage.content.push({ type: "text", text: question });
    }
    if (imageBase64) {
      userMessage.content.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : "data:image/jpeg;base64," + imageBase64 }
      });
    }
    if (userMessage.content.length > 0) {
      messages.push(userMessage);
    }

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const reply = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(reply);

    return NextResponse.json({ reply: parsed });
  } catch (error: any) {
    console.error("OpenAI Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

files.forEach(f => {
  let content = fs.readFileSync(f, "utf8");
  if(content.includes("undefined")) {
    content = content.replace(/`undefined[\s\S]*/, "`\n" + (f.includes("backend") ? END_STRING.replace("return NextResponse.json", "res.json").replace("return NextResponse.json({ error", "res.status(500).json({ error").replace("import { NextResponse } from \u0027next/server\u0027;", "").replace("export async function POST(req: Request) {", "export const askChat = async (req: Request, res: Response) => {") : END_STRING));
    fs.writeFileSync(f, content, "utf8");
  }
});

