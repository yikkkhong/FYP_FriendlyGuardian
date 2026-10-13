const https = require("node:https");
const querystring = require("node:querystring");

function getPDRMSession() {
  return new Promise((resolve) => {
    const req = https.get(
      "https://semakmule.rmp.gov.my/",
      {
        rejectUnauthorized: false,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 6000,
      },
      (res) => {
        const rawCookies = res.headers["set-cookie"] || [];
        const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");
        resolve(cookieStr);
      },
    );

    req.on("error", () => resolve(""));
    req.on("timeout", () => {
      req.destroy();
      resolve("");
    });
  });
}

function querySemakMule(category, keyword, cookieHeader) {
  return new Promise((resolve) => {
    const postData = querystring.stringify({
      cat: category,
      kw: String(keyword).trim(),
    });

    const options = {
      hostname: "semakmule.rmp.gov.my",
      port: 443,
      path: "/api/mule/get_search_data",
      method: "POST",
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://semakmule.rmp.gov.my/",
        Origin: "https://semakmule.rmp.gov.my",
        Cookie: cookieHeader || "",
        apikey: "j3j389#nklala2",
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const reports = Number(json?.count ?? json?.data?.length ?? 0);
          resolve({
            success: true,
            account: keyword,
            reports: reports,
            raw: json,
          });
        } catch (e) {
          resolve({
            success: false,
            account: keyword,
            error: body.slice(0, 100),
          });
        }
      });
    });

    req.on("error", (err) =>
      resolve({ success: false, account: keyword, error: err.message }),
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, account: keyword, error: "timeout" });
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log("connecting pdrm semak mule...");
  const cookie = await getPDRMSession();
  console.log(`(Cookie: ${cookie ? "got" : "no Cookie"})`);
  console.log("analysing...\n");

  const targetAccounts = ["512802774281", "17900052144", "26700077605"];

  for (const acc of targetAccounts) {
    const res = await querySemakMule("bank", acc, cookie);

    if (res.success) {
      if (res.reports > 0) {
        console.log(`[🔴 HIGH_RISK]: ${res.account} -> report: ${res.reports}`);
      } else {
        console.log(
          `[🟢 SAFE]: ${res.account} -> no report (server: cat: "${res.raw?.cat}", kw: "${res.raw?.kw}")`,
        );
      }
    } else {
      console.log(`[⚠️ ERROR]: ${res.account} -> errorr: ${res.error}`);
    }
  }
}

main();
