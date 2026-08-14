const http = require("http");

function postLogin() {
  return new Promise((resolve, reject) => {
    const postData = "password=admin";
    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path: "/login",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, (res) => {
      const cookie = res.headers["set-cookie"] ? res.headers["set-cookie"][0] : "";
      resolve(cookie);
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function getUrl(pathStr, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path: pathStr,
      method: "GET",
      headers: {
        "Cookie": cookie
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, length: body.length }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const cookie = await postLogin();
  console.log("Cookie obtido:", cookie ? "SIM" : "NÃO");

  const routes = [
    "/dashboard/conversations",
    "/dashboard/appointments",
    "/dashboard/patients",
    "/dashboard/notes",
    "/dashboard/reports",
    "/dashboard/channels",
    "/dashboard/config"
  ];

  for (const r of routes) {
    const result = await getUrl(r, cookie);
    console.log(`Rota: ${r} -> Status: ${result.status} (Tamanho: ${result.length} bytes)`);
  }
}

run();
