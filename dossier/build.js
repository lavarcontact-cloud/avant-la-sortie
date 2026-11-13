#!/usr/bin/env node
/* Génère dossier/index.html (version publique) et dossier/proprietaire.html (version propriétaire)
   à partir de dossier/content.js. Usage : node dossier/build.js */
const fs = require("fs");
const path = require("path");
const D = require("./content.js");

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const I = D.identite;
const fileExists = p => p && fs.existsSync(path.join(__dirname, "..", p.replace(/^\//, "")));
const today = new Date().toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"});
const cats = [...new Set(D.galerie.map(g => g.cat))];

// Dimensions réelles des images (évite les sauts de mise en page pendant le chargement).
function imgSize(p) {
  try {
    const b = fs.readFileSync(path.join(__dirname, "..", p.replace(/^\//, "")));
    if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  } catch (e) {}
  return null;
}
const dim = p => { const s = imgSize(p); return s ? ` width="${s[0]}" height="${s[1]}"` : ""; };

function tuile(g, i, opts = {}) {
  const img = g.type === "video" ? g.poster : g.src;
  const hidePrint = opts.printLimit && i >= opts.printLimit ? " print-hide" : "";
  return `<button class="tuile${hidePrint}" type="button" data-cat="${esc(g.cat || "")}" data-type="${g.type}" data-src="${esc(g.src)}" data-titre="${esc(g.titre)}" data-credit="${esc(g.credit || "")}" aria-label="Agrandir : ${esc(g.titre)}">
      <img src="${esc(img)}"${dim(img)} alt="${esc(g.titre)}${g.credit ? ", " + esc(g.credit) : ""}" loading="lazy">
      ${g.type === "video" ? '<span class="play">VIDÉO</span>' : ""}
      ${g.titre ? `<span class="cap"><b>${esc(g.titre)}</b>${g.credit ? `<span>${esc(g.credit)}</span>` : ""}</span>` : ""}
    </button>`;
}

function page(version) {
  const proprio = version !== "public";
  const cible = D.cibles && D.cibles[version];
  const pdfHref = cible ? cible.pdf : D.pdf;
  const refsA = D.references.artistes.filter(r => r.valide);
  const struct = r => r.structure ? ` <span class="chip" style="margin-left:6px">${esc(r.structure)}</span>` : "";
  const refsS = D.references.structures.filter(r => r.valide);
  const liens = I.liens.filter(l => l.actif);
  const L = D.lavar, P = D.projet;
  const canon = cible ? "/dossier/" + cible.page : proprio ? "/dossier/proprietaire" : "/dossier";
  const title = cible ? `${cible.label}, LA VAR` : proprio ? `Dossier de candidature locataire, LA VAR, ${I.nom}` : `${I.nom}, réalisateur et photographe`;
  const desc = proprio
    ? `Dossier de candidature de LA VAR, présenté par son président ${I.nom}, pour la location d'un local : profil, références, projet d'occupation, engagements et pièces.`
    : `${I.nom}, réalisateur, photographe et producteur audiovisuel en région parisienne. Parcours, références, réalisations et projet de local professionnel.`;
  const navLinks = [...(D.cibles && D.cibles[version] ? [["#proposition","Proposition"]] : []), ["#parcours","Parcours"],["#references","Références"],["#portfolio","Réalisations"],["#projet","Projet de local"],["#lavar","LA VAR"],["#engagements","Engagements"],["#contact","Contact"]];

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(D.hero.poster)}">
<meta name="theme-color" content="#0A0A0B">
${proprio ? '<meta name="robots" content="noindex">' : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/dossier/dossier.css">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Person","name":I.nom,"jobTitle":"Réalisateur, photographe, producteur audiovisuel","email":"mailto:"+I.email,"address":{"@type":"PostalAddress","addressRegion":"Île-de-France","addressCountry":"FR"}})}</script>
</head>
<body>
<a class="skip" href="#parcours">Aller au contenu</a>
<header class="bar" id="bar">
  <div class="wrap">
    <a class="brand" href="#top">${esc(I.nom.toUpperCase())} <span>${proprio ? "· Dossier locataire" : "· Profil"}</span></a>
    <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Sections">
      ${navLinks.map(([h,l]) => `<a href="${h}">${l}</a>`).join("")}
      <a class="btn petit plein" href="${esc(pdfHref)}" download>Dossier PDF</a>
    </nav>
  </div>
</header>

<main id="top">
<section class="hero" aria-labelledby="nom">
  <div class="wrap">
    <div class="rv">
      <p class="label">${cible ? "<b>●</b> " + esc(cible.label) : proprio ? "<b>●</b> Candidature locataire de LA VAR · présentée par son président" : "<b>●</b> Profil professionnel · " + esc(I.base)}</p>
      <h1 id="nom" style="margin-top:22px">${I.nom.split(" ").map(w => `<span>${esc(w)}</span>`).join("")}</h1>
      <p class="titres">${I.titre.split(" · ").map(esc).join("<i>·</i>")}</p>
      <p class="accroche">"${esc(I.accroche)}"</p>
      <div class="ctas">
        <a class="btn" href="#parcours">Découvrir mon profil <span class="fl">→</span></a>
        ${cible ? `<a class="btn plein" href="#proposition">Voir la proposition d'occupation <span class="fl">→</span></a>`
                : proprio ? `<a class="btn plein" href="#projet">Consulter mon dossier de candidature <span class="fl">→</span></a>`
                  : `<a class="btn plein" href="/dossier/proprietaire">Consulter mon dossier de candidature <span class="fl">→</span></a>`}
      </div>
    </div>
    <figure class="viseur rv" style="margin:0">
      <div class="cadre"><video src="${esc(D.hero.video)}" poster="${esc(D.hero.poster)}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(D.hero.legende)}"></video>
      <span class="rec">TOURNAGE</span></div>
      <figcaption>${esc(D.hero.legende)}</figcaption>
    </figure>
  </div>
</section>

<section id="parcours" aria-labelledby="t-parcours">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>02</b> / Mon parcours</p>
      <h2 id="t-parcours">Un métier appris sur le terrain.</h2>
      <p>Du studio de quartier aux tournages de clips, puis à la direction artistique et au montage : une progression concrète, projet après projet.</p>
    </div>
    <div class="parcours">
      <div class="intro rv">
        <p class="lead">${esc(I.resume)}</p>
        <p class="muted" style="margin-top:22px">${esc(D.materiel)}</p>
        <div class="kit"><span>Logiciels</span>${I.logiciels.map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>
        <div class="kit"><span>Langues</span><span class="chip">${esc(I.langues)}</span></div>
      </div>
      <ol class="timeline rv">
        ${D.parcours.map(p => `<li><span class="quand">${esc(p.quand)}</span><div><h3>${esc(p.titre)}</h3><p>${esc(p.texte)}</p></div></li>`).join("")}
      </ol>
    </div>
    <div class="skills rv" aria-label="Savoir-faire">
      ${D.competences.map((c,i) => `<div class="skill"><span class="n">${String(i+1).padStart(2,"0")}</span><h3>${esc(c.titre)}</h3><p>${esc(c.texte)}</p></div>`).join("")}
    </div>
  </div>
</section>

<section id="references" aria-labelledby="t-refs" style="background:var(--noir-2)">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>03</b> / Références et collaborations</p>
      <h2 id="t-refs">Avec qui j'ai travaillé, et à quel titre.</h2>
      <p>Chaque nom est associé au rôle exact que j'ai tenu sur le projet. Ce sont des collaborations ponctuelles sur des projets, pas des partenariats commerciaux.</p>
    </div>
    <div class="refs rv">
      ${refsA.map(r => `<div class="ref"><span class="nom">${esc(r.nom)}</span><span class="role">${esc(r.role)}${struct(r)}</span></div>`).join("")}
    </div>
    <div class="refs-struct rv">
      ${refsS.map(r => `<div class="ref"><span class="nom">${esc(r.nom)}</span><p class="role">${esc(r.role)}</p></div>`).join("")}
    </div>
  </div>
</section>

<section id="portfolio" aria-labelledby="t-port">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>04</b> / Réalisations</p>
      <h2 id="t-port">Le travail, plutôt que les promesses.</h2>
      <p>Photographies, covers, images de tournage et extraits montés. Toutes les images de cette page sont issues de projets réels.</p>
    </div>
    <div class="filtres no-print" role="group" aria-label="Filtrer les réalisations">
      <button type="button" data-filtre="" aria-pressed="true">Tout</button>
      ${cats.map(c => `<button type="button" data-filtre="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}
    </div>
    <div class="galerie" id="galerie">
      ${D.galerie.map((g,i) => tuile(g, i, {printLimit: 8})).join("")}
    </div>
  </div>
</section>

${cible ? `
<section id="proposition" class="papier print-break" aria-labelledby="t-prop">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>●</b> / Proposition d'occupation</p>
      <h2 id="t-prop">${esc(cible.titre)}</h2>
      <p class="lead">${esc(cible.intro)}</p>
    </div>
    <dl class="spec rv">${cible.demande.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <div class="fonctions rv" style="margin-top:clamp(40px,6vw,70px)">
      ${cible.apports.map(([h,p]) => `<div class="fonction"><span class="tag">Pour le site</span><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}
    </div>
  </div>
</section>` : ""}
<section id="projet" class="${cible ? "sombre " : "papier "}print-break" aria-labelledby="t-projet">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>05</b> / Le projet de local</p>
      <h2 id="t-projet">Un bureau de production associatif, pas un lieu d'accueil.</h2>
      <p class="lead">${esc(P.intro)}</p>
    </div>
    <div class="fonctions rv">
      ${P.fonctions.map((f,i) => `<div class="fonction"><span class="tag${f.principal ? "" : " ponct"}">${f.principal ? "Usage principal" : "Ponctuel, avec accord"}</span><h3>${esc(f.titre)}</h3><p>${esc(f.texte)}</p></div>`).join("")}
      <div class="fonction"><span class="tag">Fonctionnement</span><h3>Calme et organisé</h3><p>Occupation gérée par l'association et coordonnée par son président. Membres et collaborateurs reçus ponctuellement, sur rendez-vous. Aucune musique amplifiée.</p></div>
    </div>
    <dl class="spec rv" style="margin-top:clamp(40px,6vw,70px)">${P.locataire.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <div class="projet-bas">
      <div class="rv">
        <h3>Ce que le local ne sera pas</h3>
        <ul class="liste-non">${P.exclus.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      ${cible ? "" : `<div class="rv">
        <h3>Le local recherché</h3>
        <dl class="spec">${P.recherche.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      </div>`}
    </div>
  </div>
</section>

<section id="lavar" class="print-break" aria-labelledby="t-lavar">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>06</b> / LA VAR, locataire envisagé</p>
      <h2 id="t-lavar">${esc(L.nom)}</h2>
      <p>La structure envisagée pour porter la location, distincte de mon activité professionnelle personnelle.</p>
    </div>
    <div class="lavar">
      <div class="rv">
        <img class="logo" src="${esc(L.logo)}" alt="Logo de ${esc(L.nom)}" loading="lazy">
        <p class="nomc">${esc(L.nomComplet)}</p>
        <p class="statut">${esc(L.statut)} · ${esc(L.role)}</p>
        <p style="margin-top:22px">${esc(L.texte)}</p>
        <div class="axes">${L.axes.map(a => `<span class="chip">${esc(a)}</span>`).join("")}</div>
        <div class="chiffres">${L.chiffres.map(([v,l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
        <p class="note" style="margin-top:10px">${esc(L.sourceChiffres)}</p>
        <p class="encart">${esc(L.distinction)}</p>
      </div>
      <div class="lavar-vis rv">
        ${L.visuels.map((g,i) => tuile(Object.assign({cat:"LA VAR", credit:""}, g), i)).join("")}
      </div>
    </div>
  </div>
</section>

<section id="engagements" class="print-break" aria-labelledby="t-eng" style="background:var(--noir-2)">
  <div class="wrap">
    <div class="sec-head rv">
      <p class="label"><b>07</b> / Engagements</p>
      <h2 id="t-eng">Un espace de travail sérieux, organisé et respectueux.</h2>
      <p>Ce à quoi LA VAR et son président s'engagent pour l'occupation du local. Les pièces correspondantes sont listées ${proprio ? "ci-dessous" : "dans la version propriétaire du dossier"}.</p>
    </div>
    <div class="eng rv">
      ${D.engagements.map(([t,p]) => `<div><b>${esc(t)}</b><p>${esc(p)}</p></div>`).join("")}
    </div>
    ${proprio ? `
    <div class="docs rv">
      <h3>Pièces du dossier</h3>
      <p class="muted no-print" style="margin-top:8px;max-width:62ch">Cette page est accessible à toute personne qui en possède le lien : elle ne contient aucune information confidentielle. Les pièces ci-dessous ne sont pas publiées en ligne ; elles sont transmises directement au bailleur, à sa demande.</p>
      <p class="muted print-only" style="margin-top:8px;max-width:62ch">Les pièces ci-dessous ne sont pas jointes à ce document : elles sont transmises directement au bailleur, à sa demande.</p>
      <div class="tabwrap"><table class="tab"><thead><tr><th>Document</th><th>Disponibilité</th></tr></thead><tbody>
        ${D.justificatifs.map(j => `<tr><td>${esc(j.nom)}</td><td>${j.public === true && fileExists(j.fichier) ? `<a href="${esc(j.fichier)}" download>Télécharger</a>` : esc(j.statut)}</td></tr>`).join("")}
      </tbody></table></div>
    </div>` : `
    <div class="no-print" style="margin-top:40px"><a class="btn" href="/dossier/proprietaire#engagements">Voir la version propriétaire et les pièces du dossier <span class="fl">→</span></a></div>`}
  </div>
</section>

<section id="contact" class="contact" aria-labelledby="t-contact">
  <div class="wrap">
    <p class="label rv"><b>08</b> / Contact et dossier</p>
    <h2 id="t-contact" class="rv" style="margin-top:20px">${I.nom.split(" ").map(esc).join("<br>")}</h2>
    <div class="coord rv">
      <div><span class="label">E-mail</span><p class="v"><a href="mailto:${esc(I.email)}">${esc(I.email)}</a></p></div>
      <div><span class="label">Téléphone</span><p class="v"><a href="tel:${esc(I.telephoneLien)}">${esc(I.telephone)}</a></p></div>
      <div><span class="label">En ligne</span><p class="v">${liens.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join("<br>")}</p></div>
    </div>
    <div class="ctas rv">
      <a class="btn plein" href="mailto:${esc(I.email)}?subject=${encodeURIComponent("Location d'un local, candidature de LA VAR (" + I.nom + ")")}">Me contacter <span class="fl">→</span></a>
      <a class="btn" href="${esc(pdfHref)}" download>Télécharger le dossier PDF</a>
      ${proprio ? "" : `<a class="btn" href="/dossier/proprietaire">Version propriétaire</a>`}
    </div>
  </div>
</section>
</main>

<footer>
  <div class="wrap"><span>${esc(I.nom)} · Dossier mis à jour le ${esc(today)}</span><span>Toutes les images présentées sont issues de projets réels.</span></div>
</footer>

<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Affichage plein écran">
  <div class="haut"><span class="mono" id="lbCount"></span><button type="button" id="lbClose">Fermer ✕</button></div>
  <div class="media" id="lbMedia"></div>
  <div class="bas"><button type="button" id="lbPrev" aria-label="Précédent">←</button><p class="legende" id="lbCap"></p><button type="button" id="lbNext" aria-label="Suivant">→</button></div>
</div>
<script src="/dossier/app.js" defer></script>
</body>
</html>
`;
}

fs.writeFileSync(path.join(__dirname, "index.html"), page("public"));
fs.writeFileSync(path.join(__dirname, "proprietaire.html"), page("proprietaire"));
for (const k of Object.keys(D.cibles || {})) fs.writeFileSync(path.join(__dirname, D.cibles[k].page + ".html"), page(k));
const hidden = [...D.references.artistes, ...D.references.structures].filter(r => !r.valide).map(r => r.nom);
console.log("OK : dossier/index.html et dossier/proprietaire.html générés.");
if (hidden.length) console.log("Références masquées en attente de validation : " + hidden.join(", "));
