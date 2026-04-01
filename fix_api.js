const fs = require('fs');

let txt = fs.readFileSync('src/app/api/ask/route.ts', 'utf8');

const target = `      const reply = response.choices[0].message.content || "{}";
      const parsed = JSON.parse(reply);
  
      return NextResponse.json(parsed);`;

const replacement = `      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });`;

if (txt.includes(target)) {
    txt = txt.replace(target, replacement);
    fs.writeFileSync('src/app/api/ask/route.ts', txt);
    console.log('Fixed route.ts');
} else {
    // Try relaxed whitespace
    txt = txt.replace(/const reply = response\.choices\[0\]\.message\.content \|\| "\{\}";\s*const parsed = JSON\.parse\(reply\);\s*return NextResponse\.json\(parsed\);/, replacement);
    fs.writeFileSync('src/app/api/ask/route.ts', txt);
    console.log('Fixed route.ts with regex');
}