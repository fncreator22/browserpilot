import * as cheerio from "cheerio";

async function probe() {
  console.log("=========================================");
  console.log("PROBING EXTERNAL JOB SOURCES");
  console.log("=========================================");

  // 1. LinkedIn
  console.log("\n1. LINKEDIN GUEST API:");
  const liUrl = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software+Engineer&location=Worldwide&sortBy=DD";
  console.log("URL:", liUrl);
  try {
    const liRes = await fetch(liUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    console.log("Status:", liRes.status, liRes.statusText);
    const liHtml = await liRes.text();
    const $li = cheerio.load(liHtml);
    const jobCount = $li("li").length;
    console.log("Job listings parsed:", jobCount);
  } catch (e: any) {
    console.log("LinkedIn Error:", e.message);
  }

  // 2. YC
  console.log("\n2. Y COMBINATOR (workatastartup.com):");
  const ycUrl = "https://www.workatastartup.com/companies?query=Software%20Engineer";
  console.log("URL:", ycUrl);
  try {
    const ycRes = await fetch(ycUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    console.log("Status:", ycRes.status, ycRes.statusText);
    const ycHtml = await ycRes.text();
    const $yc = cheerio.load(ycHtml);
    console.log("Page Title:", $yc("title").text());
    console.log("Element .company-card matches:", $yc(".company-card").length);
    console.log("Element div[data-company-name] matches:", $yc("div[data-company-name]").length);
    console.log("Element a[href*='/companies/'] matches:", $yc("a[href*='/companies/']").length);
    console.log("HTML length:", ycHtml.length);
  } catch (e: any) {
    console.log("YC Error:", e.message);
  }

  // 3. Indeed
  console.log("\n3. INDEED PUBLIC SEARCH:");
  const inUrl = "https://www.indeed.com/jobs?q=Software+Engineer";
  console.log("URL:", inUrl);
  try {
    const inRes = await fetch(inUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    console.log("Status:", inRes.status, inRes.statusText);
    const inHtml = await inRes.text();
    console.log("HTML snippet:", inHtml.substring(0, 300));
  } catch (e: any) {
    console.log("Indeed Error:", e.message);
  }

  // 4. Direct ATS Endpoints (Ashby, Greenhouse, Lever, Workday)
  console.log("\n4. DIRECT ATS API/ENDPOINTS (Ashby, Greenhouse, Lever):");
  console.log("Ashby API (e.g. Ramp): https://api.ashbyhq.com/posting-api/job-board/ramp");
  try {
    const ashbyRes = await fetch("https://api.ashbyhq.com/posting-api/job-board/ramp");
    console.log("Ashby Ramp Status:", ashbyRes.status);
    const data: any = await ashbyRes.json();
    console.log("Ashby Ramp jobs count:", data.jobs ? data.jobs.length : 0);
  } catch (e: any) {
    console.log("Ashby error:", e.message);
  }

  console.log("Greenhouse API (e.g. Figma): https://boards-api.greenhouse.io/v1/boards/figma/jobs");
  try {
    const ghRes = await fetch("https://boards-api.greenhouse.io/v1/boards/figma/jobs");
    console.log("Greenhouse Figma Status:", ghRes.status);
    const data: any = await ghRes.json();
    console.log("Greenhouse Figma jobs count:", data.jobs ? data.jobs.length : 0);
  } catch (e: any) {
    console.log("Greenhouse error:", e.message);
  }

  console.log("Lever API (e.g. Netflix): https://api.lever.co/v0/postings/netflix");
  try {
    const leverRes = await fetch("https://api.lever.co/v0/postings/netflix");
    console.log("Lever Netflix Status:", leverRes.status);
    const data: any = await leverRes.json();
    console.log("Lever Netflix jobs count:", Array.isArray(data) ? data.length : 0);
  } catch (e: any) {
    console.log("Lever error:", e.message);
  }
}

probe().catch(console.error);
