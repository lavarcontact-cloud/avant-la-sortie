/* Interactions du dossier : barre, menu mobile, apparitions, filtres de galerie, plein écran. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Barre : bordure au défilement
  const bar = $("#bar");
  const onScroll = () => bar && bar.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Menu mobile
  const btn = $("#menuBtn"), nav = $("#nav");
  if (btn && nav) {
    btn.addEventListener("click", () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", String(o)); btn.textContent = o ? "Fermer" : "Menu"; });
    $$("a", nav).forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); btn.textContent = "Menu"; }));
  }

  // Apparitions au défilement (contenu visible sans JS ni observateur)
  const rv = $$(".rv");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(el => io.observe(el));
    setTimeout(() => rv.forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add("in"); }), 60);
  } else rv.forEach(el => el.classList.add("in"));
  window.addEventListener("beforeprint", () => rv.forEach(el => el.classList.add("in")));

  // Filtres de la galerie
  const filtres = $$(".filtres button");
  filtres.forEach(b => b.addEventListener("click", () => {
    const f = b.dataset.filtre;
    filtres.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $$("#galerie .tuile").forEach(t => { t.hidden = !!f && t.dataset.cat !== f; });
  }));

  // Plein écran
  const lb = $("#lb"), media = $("#lbMedia"), cap = $("#lbCap"), count = $("#lbCount");
  let items = [], idx = 0, lastFocus = null;
  function show(i) {
    idx = (i + items.length) % items.length;
    const t = items[idx];
    media.innerHTML = "";
    if (t.dataset.type === "video") {
      const v = document.createElement("video");
      v.src = t.dataset.src; v.controls = true; v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
      v.poster = t.querySelector("img")?.src || "";
      media.appendChild(v);
    } else {
      const im = document.createElement("img");
      im.src = t.dataset.src; im.alt = t.querySelector("img")?.alt || "";
      media.appendChild(im);
    }
    cap.innerHTML = "";
    const b = document.createElement("b"); b.textContent = t.dataset.titre; cap.appendChild(b);
    if (t.dataset.credit) cap.appendChild(document.createTextNode(" · " + t.dataset.credit));
    count.textContent = String(idx + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
  }
  function open(t) {
    const scope = t.closest(".galerie, .lavar-vis") || document;
    items = $$(".tuile", scope).filter(x => !x.hidden);
    lastFocus = t; lb.hidden = false; document.body.style.overflow = "hidden";
    show(items.indexOf(t)); $("#lbClose").focus();
  }
  function close() { lb.hidden = true; media.innerHTML = ""; document.body.style.overflow = ""; lastFocus && lastFocus.focus(); }
  $$(".tuile").forEach(t => t.addEventListener("click", () => open(t)));
  $("#lbClose").addEventListener("click", close);
  $("#lbPrev").addEventListener("click", () => show(idx - 1));
  $("#lbNext").addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", e => { if (e.target === lb || e.target === media) close(); });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });
  let x0 = null;
  media.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  media.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });
})();
