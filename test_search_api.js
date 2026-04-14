async function run() {
  const r = await fetch("http://localhost:3000/api/drugs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: "타이레놀" })
  });
  const data = await r.json();
  console.dir(data, { depth: null });
}
run();
