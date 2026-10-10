import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getArtists, getFeed, getProjects, getReviewQueue, site } from "@/lib/content";

const pub = path.resolve(import.meta.dirname, "../public");

describe("contenu", () => {
  it("se charge et passe la validation", () => {
    expect(getProjects().length).toBeGreaterThan(5);
    expect(getArtists().length).toBeGreaterThan(5);
    expect(site.contact.email).toContain("@");
  });

  it("chaque média référencé existe sur disque", () => {
    const missing: string[] = [];
    for (const p of getProjects()) {
      for (const m of p.media) {
        if (!fs.existsSync(path.join(pub, m.src))) missing.push(m.src);
        if (m.kind === "video" && !fs.existsSync(path.join(pub, m.poster))) missing.push(m.poster);
        if (m.kind === "video" && !fs.existsSync(path.join(pub, m.src.replace(/\.mp4$/, ".webm")))) missing.push(m.src + " (webm)");
      }
      if (!fs.existsSync(path.join(pub, p.cover))) missing.push(p.cover);
    }
    for (const a of getArtists())
      if (a.portrait && !fs.existsSync(path.join(pub, a.portrait))) missing.push(a.portrait);
    expect(missing).toEqual([]);
  });

  it("le flux ne contient que des vidéos", () => {
    const feed = getFeed();
    expect(feed.length).toBeGreaterThan(3);
    for (const f of feed) expect(f.video.kind).toBe("video");
  });

  it("aucun texte visible n'utilise de guillemets « » ni de tiret cadratin", () => {
    const raw = ["projects", "artists", "services", "site"]
      .map((n) => fs.readFileSync(path.resolve(import.meta.dirname, `../content/${n}.json`), "utf8"))
      .join("");
    expect(raw).not.toMatch(/[«»—]/);
  });

  it("expose une file de vérification non vide tant que les droits ne sont pas confirmés", () => {
    expect(getReviewQueue().projects.length).toBeGreaterThan(0);
  });
});
