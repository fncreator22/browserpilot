async function checkRoute(name: string, url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url);
    const duration = Date.now() - start;
    const contentType = res.headers.get("content-type") || "";
    let preview = "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      preview = JSON.stringify(data).slice(0, 100);
    } else {
      const text = await res.text();
      preview = text.slice(0, 80).replace(/\s+/g, " ");
    }
    console.log(`[${res.status}] ${name} (${duration}ms): ${preview}...`);
    return res.status;
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message);
    return 0;
  }
}

async function main() {
  console.log("Checking local server health on http://localhost:3000...");
  await checkRoute("Home Page", "http://localhost:3000/");
  await checkRoute("Connectors API", "http://localhost:3000/api/connectors");
  await checkRoute("Watch Page", "http://localhost:3000/app/watch");
  await checkRoute("Discover Page", "http://localhost:3000/app");
}

main();
