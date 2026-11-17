// Solvei: fysisk bevegelse med fjærer (damping + respons, som Apple beskriver dem).
// Fjæren starter alltid fra verdien på skjermen og tar med seg farten, så bevegelsen kan avbrytes og snus når som helst.
// Ingen scroll-lytter: IntersectionObserver gir målene, requestAnimationFrame går bare mens noe er i bevegelse.
(() => {
  const rolig = matchMedia("(prefers-reduced-motion: reduce)");
  if (rolig.matches) return;

  const aktive = new Set();
  let ramme = 0, sist = 0;

  function fjaer(sett, { damping = 1, respons = 0.4, start = 0 } = {}) {
    const k = (2 * Math.PI / respons) ** 2, c = 4 * Math.PI * damping / respons;
    const f = { x: start, v: 0, mal: start, k, c, sett };
    f.til = (mal) => { f.mal = mal; aktive.add(f); if (!ramme) { sist = performance.now(); ramme = requestAnimationFrame(steg); } };
    sett(start);
    return f;
  }

  function steg(na) {
    const dt = Math.min(0.064, (na - sist) / 1000); sist = na;
    const n = Math.ceil(dt / 0.004), h = dt / n;
    for (const f of aktive) {
      for (let i = 0; i < n; i++) { f.v += (-f.k * (f.x - f.mal) - f.c * f.v) * h; f.x += f.v * h; }
      if (Math.abs(f.v) < 0.02 && Math.abs(f.x - f.mal) < 0.05) { f.x = f.mal; f.v = 0; aktive.delete(f); }
      f.sett(f.x);
    }
    ramme = aktive.size ? requestAnimationFrame(steg) : 0;
  }

  // Produktvinduet stiger opp av mintflaten: står lavt når scenen er delvis synlig, glir opp når den kommer helt inn.
  const vindu = document.getElementById("vindu"), scene = vindu && vindu.parentElement;
  if (vindu) {
    const DYBDE = 96;
    const f = fjaer((y) => vindu.style.setProperty("--vindu-y", y.toFixed(2) + "px"), { damping: 1, respons: 0.55, start: DYBDE });
    const terskler = Array.from({ length: 41 }, (_, i) => i / 40);
    new IntersectionObserver(([e]) => {
      // Rullet forbi (scenen over skjermen): vinduet blir stående oppe.
      const forbi = e.boundingClientRect.top < 0;
      const andel = forbi ? 1 : e.isIntersecting ? e.intersectionRatio : 0;
      f.til(Math.round((1 - andel) * DYBDE));
    }, { threshold: terskler }).observe(scene);
  }

  // Kortene: kommer opp fra under når de rulles inn, løftes ved pekeren, trykkes ned ved klikk.
  const kort = [...document.querySelectorAll("[data-loft]")];
  const sett = (el) => (y) => el.style.setProperty("--loft-y", y.toFixed(2) + "px");
  const fjaerer = new Map(kort.map((el) => [el, fjaer(sett(el), { damping: 0.86, respons: 0.5 })]));
  const sett_inn = new WeakSet(), venter = new WeakSet();

  const io = new IntersectionObserver((oppf) => {
    oppf.forEach((e) => {
      const el = e.target, f = fjaerer.get(el);
      if (!sett_inn.has(el) && !venter.has(el) && !e.isIntersecting && e.boundingClientRect.top > 0) {
        venter.add(el); f.x = 48; f.mal = 48; f.sett(48); // under kanten, ikke synlig ennå
        return;
      }
      if (e.isIntersecting && !sett_inn.has(el)) {
        sett_inn.add(el);
        const i = [...el.parentElement.children].indexOf(el);
        setTimeout(() => f.til(0), i * 70);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.15 });
  kort.forEach((el) => io.observe(el));

  const kanSveve = matchMedia("(hover: hover)");
  kort.forEach((el) => {
    const f = fjaerer.get(el);
    el.addEventListener("pointerenter", () => { if (kanSveve.matches && sett_inn.has(el)) f.til(-8); });
    el.addEventListener("pointerleave", () => { if (sett_inn.has(el)) f.til(0); });
    el.addEventListener("pointerdown", () => { if (sett_inn.has(el)) f.til(2); });
    el.addEventListener("pointerup", () => { if (sett_inn.has(el)) f.til(kanSveve.matches ? -8 : 0); });
    el.addEventListener("pointercancel", () => f.til(0));
  });

  // Skrur brukeren på redusert bevegelse underveis, legger alt seg rolig på plass.
  rolig.addEventListener("change", (e) => { if (e.matches) { fjaerer.forEach((f) => f.til(0)); } });
})();

// Toppmeny som følger med: vises når den store logoen er rullet forbi. Mobil: Meny-knappen åpner panelet.
(() => {
  const bar = document.getElementById('toppbar');
  const logo = document.getElementById('stor-logo');
  if (!bar || !logo) return;
  const knapp = bar.querySelector('.toppbar__knapp');
  const panel = bar.querySelector('.toppbar__panel');
  const settMeny = (apen) => { knapp.setAttribute('aria-expanded', String(apen)); panel.classList.toggle('er-apen', apen); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([p]) => {
      const vis = !p.isIntersecting;
      bar.classList.toggle('er-synlig', vis);
      if (!vis) settMeny(false);
    }).observe(logo);
  }
  knapp.addEventListener('click', () => settMeny(knapp.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) settMeny(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') settMeny(false); });
})();
