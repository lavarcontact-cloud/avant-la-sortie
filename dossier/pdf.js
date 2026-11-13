#!/usr/bin/env node
/* Génère le PDF du dossier à partir de la version propriétaire (feuille d'impression A4).
   Usage : node dossier/pdf.js   (nécessite Playwright et Chromium) */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const D = require("./content.js");

const root = path.join(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".pdf": "application/pdf" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p === "/dossier" || p === "/dossier/") p = "/dossier/index.html";
  else if (!path.extname(p)) p += ".html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/dossier/proprietaire`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const out = path.join(root, D.pdf.replace(/^\//, ""));
    await page.pdf({
      path: out, format: "A4", printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:7pt;color:#777;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif"><span>LA VAR · Dossier de candidature locataire présenté par ${D.identite.nom}, président</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
    });
    console.log("OK : " + path.relative(root, out));
  } finally { await browser.close(); server.close(); }
});
