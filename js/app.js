'use strict';

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
// url() para variables CSS: se resuelve contra la página (no contra la carpeta css/)
const cssUrl = p => `url(${JSON.stringify(new URL(p, document.baseURI).href)})`;
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '#');

// Imagen de reemplazo (iniciales + color) cuando no hay imagen o no carga
function ph(name = '?') {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const ini = String(name).trim().split(/\s+/).filter(w => /^\p{L}/u.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h},45%,32%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},50%,14%)"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <text x="100" y="118" font-size="64" text-anchor="middle" fill="rgba(255,255,255,.75)" font-family="Georgia,serif">${esc(ini)}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
window.ph = ph;

const imgTag = (src, name, cls = '') =>
  `<img class="${cls}" src="${esc(src || ph(name))}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null;this.src=ph(this.alt)">`;

const linksHtml = (links = []) =>
  links.map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.plataforma || l.titulo || 'Enlace')}</a>`).join('');

const paragraphs = txt => String(txt || '').split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');

function fmtDate(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y) return str;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ============================================================
   Estado y carga de datos
   ============================================================ */
const S = { cfg: {}, historias: [], personajes: [], noticias: [], media: [], storyId: null, charId: null, worldId: null };
const storyById = id => S.historias.find(h => h.id === id);
const charById = id => S.personajes.find(p => p.id === id);

// Una conexión puede ser "id" o { id, tipo, nota }
const connOf = c => (typeof c === 'string' ? { id: c } : c);
const TIPO_CONEXION = {
  antes: 'Léela antes',
  despues: 'Léela después',
  paralela: 'Ocurre en paralelo',
  relacionada: 'Relacionada'
};

async function loadData() {
  const get = f => fetch(`data/${f}.json`).then(r => {
    if (!r.ok) throw new Error(`No se pudo cargar data/${f}.json`);
    return r.json();
  });
  const [cfg, historias, personajes, noticias, media, universos] = await Promise.all(
    ['config', 'historias', 'personajes', 'noticias', 'media', 'universos'].map(get)
  );
  S.cfg = cfg;
  S.historias = historias.historias || [];
  S.gruposRaw = historias.conexiones_grupos || [];
  S.universos = universos.universos || [];
  S.personajes = personajes.personajes || [];
  S.noticias = noticias.noticias || [];
  S.media = media.media || [];
}

/* ============================================================
   Navegación entre secciones (#inicio, #personajes/id-historia ...)
   ============================================================ */
const VIEWS = ['inicio', 'noticias', 'personajes', 'multiverso', 'media'];

function showView(v) {
  if (!VIEWS.includes(v)) v = 'inicio';
  VIEWS.forEach(x => { $('#view-' + x).hidden = x !== v; });
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  return v;
}

function route() {
  const [v, arg, ch] = location.hash.slice(1).split('/');
  const view = showView(v);
  window.scrollTo(0, 0);
  if (view === 'personajes') { selectStory(arg && storyById(arg) ? arg : (S.storyId || S.historias[0]?.id), false); if (ch && charById(ch)) selectChar(ch); }
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-scroll]');
  if (!a) return;
  e.preventDefault();
  if (location.hash !== '#inicio' && location.hash !== '') location.hash = '#inicio';
  showView('inicio');
  setTimeout(() => document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }), 30);
});

/* ============================================================
   INICIO
   ============================================================ */
function renderInicio() {
  const s = S.cfg.sitio || {};
  document.title = s.nombre || 'Mis Historias';
  $('#site-name').textContent = s.nombre || 'Mis Historias';
  $('#hero-title').textContent = s.titulo || s.nombre || 'Bienvenido';
  $('#hero-lema').textContent = s.lema || '';
  $('#hero-welcome').innerHTML = (s.bienvenida || []).map(p => `<p>${esc(p)}</p>`).join('');
  if (s.fondo_inicio) $('#hero-bg').style.setProperty('--hero-img', cssUrl(s.fondo_inicio));
  if (s.imagen_inicio) {
    const art = $('#hero-art');
    art.onload = () => { $('#hero-art-wrap').hidden = false; };
    art.onerror = () => { $('#hero-art-wrap').hidden = true; };
    art.src = s.imagen_inicio;
  }
  $('#hero-social').innerHTML = (s.redes || []).map(r => `<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${esc(r.nombre)}</a>`).join('');
  if (s.pie) $('#footer-text').textContent = s.pie;

  $('#story-grid').innerHTML = S.historias.map(h => `
    <article class="story-card">
      <div class="cover">${imgTag(h.portada || h.icono, h.titulo)}</div>
      <div class="body">
        <h3>${esc(h.titulo)}</h3>
        <p class="meta">${esc([h.estado, h.genero].filter(Boolean).join(' - '))}</p>
        <p class="syn">${esc(h.sinopsis)}</p>
        <div class="links">${linksHtml(h.enlaces)}</div>
        <div class="actions"><a class="btn small" href="#personajes/${esc(h.id)}">Ver personajes</a></div>
      </div>
    </article>`).join('');
}

/* ============================================================
   NOTICIAS
   ============================================================ */
function renderNoticias() {
  const list = [...S.noticias].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  $('#news-list').innerHTML = list.length ? list.map(n => {
    const h = storyById(n.historia);
    return `<article class="news">
      <time>${esc(fmtDate(n.fecha))}</time>${n.etiqueta ? `<span class="tag">${esc(n.etiqueta)}</span>` : ''}
      <h3>${esc(n.titulo)}</h3>
      <p>${esc(n.texto)}</p>
      ${h ? `<p class="muted">Historia: <a href="#personajes/${esc(h.id)}">${esc(h.titulo)}</a></p>` : ''}
      ${n.url ? `<div class="links"><a href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${esc(n.url_texto || 'Leer más')}</a></div>` : ''}
    </article>`;
  }).join('') : '<p class="hint">Aún no hay noticias.</p>';
}

/* ============================================================
   PERSONAJES
   ============================================================ */
function renderRail() {
  $('#rail-list').innerHTML = S.historias.map(h => `
    <button class="rail-item" data-id="${esc(h.id)}">
      <span class="rail-icon">${imgTag(h.icono, h.titulo)}</span>
      <span class="rail-label">${esc(h.titulo)}</span>
    </button>`).join('');
}

function selectStory(id, updateHash = true) {
  const h = storyById(id);
  if (!h) return;
  S.storyId = id;
  if (updateHash) history.replaceState(null, '', `#personajes/${id}`);

  $$('.rail-item').forEach(b => {
    const on = b.dataset.id === id;
    b.classList.toggle('active', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  $('#pj-bg').style.setProperty('--story-bg', h.fondo ? cssUrl(h.fondo) : 'none');

  // Tarjeta de la historia (enlaces para leerla)
  $('#story-h3').textContent = h.titulo;
  $('#story-syn').textContent = h.sinopsis || '';
  $('#story-links').innerHTML = linksHtml(h.enlaces);

  const chars = S.personajes.filter(p => p.historia === id);
  $('#pj-thumbs').innerHTML = chars.map(c => `
    <button class="thumb" data-id="${esc(c.id)}" title="${esc(c.nombre)}">${imgTag(c.avatar || c.arte, c.nombre)}</button>`).join('');
  $('#char-cards').hidden = !chars.length;
  $('#pj-empty').hidden = chars.length > 0;
  $('#pj-desc').hidden = !chars.length;

  if (chars.length) {
    selectChar(chars[0].id);
  } else {
    $('#pj-name').textContent = h.titulo;
    $('#pj-title').textContent = 'Sin personajes por ahora';
    $('#pj-art').removeAttribute('src');
    $('#pj-art-wrap').style.setProperty('--art', 'none');
    S.charId = null;
  }
  updateArrows();
}

function selectChar(id) {
  const c = charById(id);
  if (!c) return;
  S.charId = id;
  $$('.thumb').forEach(t => {
    const on = t.dataset.id === id;
    t.classList.toggle('active', on);
    if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  $('#pj-name').textContent = c.nombre;
  $('#pj-title').textContent = c.titulo || '';
  $('#pj-desc').textContent = c.descripcion || '';

  const art = $('#pj-art');
  art.alt = c.nombre;
  art.classList.add('swap');
  art.onload = () => art.classList.remove('swap');
  art.onerror = () => {
    art.onerror = null;
    art.src = ph(c.nombre);
    $('#pj-art-wrap').style.setProperty('--art', cssUrl(ph(c.nombre)));
  };
  const artSrc = c.arte || ph(c.nombre);
  $('#pj-art-wrap').style.setProperty('--art', cssUrl(artSrc));
  art.src = artSrc;

  $('#char-bio').innerHTML = paragraphs(c.historia_personal) || '<p class="hint">Todavía no hay historia escrita.</p>';
  $('#char-data').innerHTML = Object.entries(c.datos || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')
    || '<p class="hint">Sin datos.</p>';
  $('#char-apps').innerHTML = (c.apariciones || []).map(a =>
    `<li><a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.titulo)}</a></li>`).join('')
    || '<li class="hint">Sin apariciones registradas.</li>';

  renderOpiniones(c);
  updateArrows();
}

function stepStory(d) {
  const i = S.historias.findIndex(h => h.id === S.storyId) + d;
  if (i >= 0 && i < S.historias.length) selectStory(S.historias[i].id);
}

function stepChar(d) {
  const chars = S.personajes.filter(p => p.historia === S.storyId);
  const i = chars.findIndex(c => c.id === S.charId) + d;
  if (i >= 0 && i < chars.length) selectChar(chars[i].id);
}

function updateArrows() {
  const si = S.historias.findIndex(h => h.id === S.storyId);
  const chars = S.personajes.filter(p => p.historia === S.storyId);
  const ci = chars.findIndex(c => c.id === S.charId);
  $('#rail-up').disabled = si <= 0;
  $('#rail-down').disabled = si < 0 || si >= S.historias.length - 1;
  $('#thumb-prev').disabled = ci <= 0;
  $('#thumb-next').disabled = ci < 0 || ci >= chars.length - 1;
}

function renderOpiniones(c) {
  const ops = c.opiniones || [];
  $('#op-who').textContent = c.nombre;
  const out = $('#op-out');
  out.innerHTML = '';

  if (!ops.length) {
    $('#op-chips').innerHTML = '';
    out.innerHTML = '<p class="hint">Todavía no hay opiniones registradas.</p>';
    return;
  }
  $('#op-chips').innerHTML = ops.map(o => {
    const t = charById(o.target_id);
    const name = t ? t.nombre : (o.target_nombre || o.target_id);
    const n = (o.dialogos || (o.pensamiento ? [o.pensamiento] : [])).length;
    return `<button class="chip" data-target="${esc(o.target_id)}">${imgTag(t?.avatar || t?.arte, name)}<span>${esc(name)}</span>${n > 1 ? `<small>${n}</small>` : ''}</button>`;
  }).join('');
  out.innerHTML = '<p class="hint">Elige un personaje.</p>';
}

function showOpinion(targetId) {
  const c = charById(S.charId);
  const o = (c?.opiniones || []).find(x => x.target_id === targetId);
  if (!o) return;
  const lines = o.dialogos || (o.pensamiento ? [o.pensamiento] : []);
  $$('#op-chips .chip').forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  $('#op-out').innerHTML = lines.map((t, i) => `
    <div class="bubble" style="animation-delay:${i * 120}ms">
      ${imgTag(c.avatar || c.arte, c.nombre)}<p>${esc(t)}</p>
    </div>`).join('');
}

/* ============================================================
   MULTIVERSO
   ============================================================ */
// Reparte los mundos por todo el mapa y separa los que quedan muy juntos
function layoutPos() {
  const P = S.historias.map((h, i) => {
    const m = h.mapa || { x: 16 + (i * 23) % 68, y: 22 + (i * 31) % 56 };
    return { x: m.x, y: m.y };
  });
  for (let it = 0; it < 80; it++) {
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
      const dx = (P[b].x - P[a].x) * 2, dy = P[b].y - P[a].y; // el mapa es ~2 veces más ancho que alto
      const d = Math.hypot(dx, dy) || 0.01, min = 24;
      if (d < min) {
        const k = (min - d) / (2 * d);
        P[a].x -= dx * k / 2; P[a].y -= dy * k;
        P[b].x += dx * k / 2; P[b].y += dy * k;
      }
    }
    P.forEach(p => { p.x = Math.min(92, Math.max(8, p.x)); p.y = Math.min(88, Math.max(10, p.y)); });
  }
  return P;
}

/* Conexiones: cada "grupo" es un punto de tu documento (historias que se conectan entre sí).
   Además se siguen aceptando las conexiones sueltas de cada historia (campo "conexiones"). */
function buildGroups() {
  const gs = [];
  (S.gruposRaw || []).forEach((g, i) => {
    const ids = (g.historias || []).filter(id => storyById(id));
    const edges = [];
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) edges.push({ a: ids[x], b: ids[y] });
    gs.push({ nombre: g.nombre || `Conexión ${i + 1}`, nota: g.nota || '', edges });
  });
  const extra = [];
  S.historias.forEach(h => (h.conexiones || []).map(connOf).forEach(c => {
    if (storyById(c.id)) extra.push({ a: h.id, b: c.id, from: h.id, tipo: c.tipo, nota: c.nota });
  }));
  if (extra.length) gs.push({ nombre: 'Otras conexiones', nota: '', edges: extra });
  S.grupos = gs;
}

function renderMapa() {
  buildGroups();
  const pos = {};
  const L = layoutPos();
  S.historias.forEach((h, i) => { pos[h.id] = L[i]; });

  let lines = '';
  S.grupos.forEach((g, gi) => g.edges.forEach(e => {
    if (!pos[e.a] || !pos[e.b]) return;
    lines += `<line data-g="${gi}" data-a="${esc(e.a)}" data-b="${esc(e.b)}" x1="${pos[e.a].x}" y1="${pos[e.a].y}" x2="${pos[e.b].x}" y2="${pos[e.b].y}"/>`;
  }));
  $('#mv-lines').innerHTML = lines;

  $('#mv-nodes').innerHTML = S.historias.map(h => `
    <button class="node" data-id="${esc(h.id)}" style="left:${pos[h.id].x}%;top:${pos[h.id].y}%">
      <span class="node-orb">${imgTag(h.icono, h.titulo)}</span>
      <span class="node-label">${esc(h.titulo)}</span>
    </button>`).join('');
}

// g = número de grupo a mostrar (opcional). Si no se indica, se conserva el actual si la historia pertenece a él.
function selectWorld(id, g) {
  const h = storyById(id);
  if (!h) return;
  S.worldId = id;
  $('#mv-body').classList.add('open');
  const touches = e => e.a === id || e.b === id;
  const mine = S.grupos.map((_, i) => i).filter(i => S.grupos[i].edges.some(touches));
  const active = mine.includes(g) ? g : (mine.includes(S.activeGroup) ? S.activeGroup : mine[0]);
  S.activeGroup = active;

  const edges = active === undefined ? [] : S.grupos[active].edges.filter(touches);
  const conn = new Set(edges.map(e => (e.a === id ? e.b : e.a)));

  $$('.node').forEach(n => {
    n.classList.toggle('active', n.dataset.id === id);
    n.classList.toggle('dim', n.dataset.id !== id && !conn.has(n.dataset.id));
  });
  // Solo se ven las líneas de ESTA historia dentro del grupo elegido
  $('#mv-lines').classList.add('sel');
  $$('#mv-lines line').forEach(l => l.classList.toggle('on',
    Number(l.dataset.g) === active && (l.dataset.a === id || l.dataset.b === id)));

  $('#mv-hint').hidden = true;
  $('#mv-info').hidden = false;
  $('#mv-title').textContent = h.titulo;
  $('#mv-meta').textContent = [h.epoca, h.estado].filter(Boolean).join(' - ');
  $('#mv-syn').textContent = h.sinopsis || '';
  $('#mv-links').innerHTML = linksHtml(h.enlaces);
  $('#mv-chars').href = `#personajes/${h.id}`;

  // Si pertenece a varios grupos, se elige cuál ver
  $('#mv-groups').innerHTML = mine.length > 1
    ? mine.map(i => `<button class="seg-btn ${i === active ? 'active' : ''}" data-group="${i}">${esc(S.grupos[i].nombre)}</button>`).join('')
    : '';
  $('#mv-gnote').textContent = active !== undefined ? (S.grupos[active].nota || '') : '';

  const seen = new Set();
  $('#mv-conn').innerHTML = edges.map(e => {
    const oid = e.a === id ? e.b : e.a;
    if (seen.has(oid)) return '';
    seen.add(oid);
    const o = storyById(oid);
    const extra = e.from === id ? [TIPO_CONEXION[e.tipo], e.nota].filter(Boolean).join(': ') : '';
    return `<div class="conn">
      <button class="chip" data-world="${esc(oid)}">${imgTag(o.icono, o.titulo)}<span>${esc(o.titulo)}</span></button>
      ${extra ? `<p>${esc(extra)}</p>` : ''}
    </div>`;
  }).join('') || '<span class="hint">Aún sin conexiones.</span>';
}

function closeWorld() {
  S.worldId = null;
  $('#mv-body').classList.remove('open');
  $$('.node').forEach(n => n.classList.remove('active', 'dim'));
  $('#mv-lines').classList.remove('sel');
  $$('#mv-lines line').forEach(l => l.classList.remove('on'));
}

/* Pestaña Universo: las historias de cada universo salen de data/universos.json */
// "Basado en...": imágenes de proporción normal (3:4 y 16:9), centradas y ajustadas al espacio disponible
function fitBase() {
  const b = $('#uni-base'), t = $('.ub-top', b), d = $('.ub-desc', b);
  if (!t || !d) return;
  if (window.innerWidth <= 900) { t.removeAttribute('style'); d.removeAttribute('style'); return; }
  const g = 18, wOf = H => 0.75 * H + g + (H - g) * 8 / 9;
  let H = Math.max(240, b.clientHeight - 120 - g);
  if (wOf(H) > b.clientWidth) H = Math.max(240, (b.clientWidth - g / 9) / 1.6389);
  t.style.cssText = `width:${wOf(H)}px;height:${H}px;grid-template-columns:${0.75 * H}px 1fr`;
  d.style.width = wOf(H) + 'px';
}
window.addEventListener('resize', () => { if (!$('#uni-base').hidden) fitBase(); });

function renderUniverso(uid, sid, mode) {
  const us = S.universos || [];
  if (!us.length) return;
  const u = us.find(x => x.id === (uid || S.uniId)) || us[0];
  S.uniId = u.id;
  if (mode) S.uniMode = mode;
  const base = S.uniMode === 'base';
  const ids = (u.historias || []).filter(storyById);
  if (sid) S.uniStory = sid;
  if (!ids.includes(S.uniStory)) S.uniStory = ids[0];
  const h = storyById(S.uniStory);

  $('#uni-unis').innerHTML = us.map(x => `<div class="uni-grp">
    <button class="uni-btn ${x.id === u.id && !base ? 'active' : ''}" data-uni="${esc(x.id)}">${esc(x.nombre || x.id)}</button>
    <button class="uni-btn ${x.id === u.id && base ? 'active' : ''}" data-base="${esc(x.id)}">Basado en...</button></div>`).join('');
  $('#uni-list').innerHTML = ids.map(id => {
    const s = storyById(id);
    return `<button class="uni-item ${id === S.uniStory && !base ? 'active' : ''}" data-story="${esc(id)}">${imgTag(s.icono, s.titulo)}<span>${esc(s.titulo)}</span></button>`;
  }).join('') || '<p class="hint">Aún no hay historias en este universo.</p>';
  $('#uni-main').hidden = base;
  $('#uni-base').hidden = !base;

  if (base) {
    const b = u.basado_en || {};
    const im = n => (b.imagenes || [])[n] ? imgTag(b.imagenes[n], `Imagen ${n + 1}`) : `<div class="ub-ph">Imagen ${n + 1}</div>`;
    $('#uni-base').innerHTML = `<div class="ub-top"><div class="ub-img a">${im(0)}</div><div class="ub-img">${im(1)}</div><div class="ub-img">${im(2)}</div></div>
      <div class="ub-desc">${b.descripcion ? paragraphs(b.descripcion) : '<p class="hint">Aquí va la descripción de en qué se basa este universo.</p>'}</div>`;
    fitBase();
    return;
  }
  if (!h) { $('#uni-card').innerHTML = ''; $('#uni-cover').innerHTML = ''; return; }

  // El recuadro de la portada toma la proporción real de la imagen (sin espacios vacíos)
  const cv = $('#uni-cover');
  cv.style.setProperty('--ar', '2 / 3');
  cv.innerHTML = imgTag(h.portada || h.icono, h.titulo);
  const pic = cv.firstElementChild;
  const ar = () => { if (pic.naturalWidth) cv.style.setProperty('--ar', `${pic.naturalWidth} / ${pic.naturalHeight}`); };
  if (pic.complete) ar(); else pic.addEventListener('load', ar);

  const chars = S.personajes.filter(p => p.historia === h.id);
  $('#uni-card').innerHTML = `<h3>${esc(h.titulo)}</h3>
    <p class="mv-meta">${esc([h.estado, h.genero].filter(Boolean).join(' - '))}</p>
    <div class="links">${linksHtml(h.enlaces)}</div>
    <div class="uni-chars">${chars.map(c =>
      `<a class="uni-char" href="#personajes/${esc(h.id)}/${esc(c.id)}" title="${esc(c.nombre)}">${imgTag(c.arte || c.avatar, c.nombre)}<span>${esc(c.nombre)}</span></a>`
    ).join('') || '<p class="hint">Esta historia todavía no tiene personajes registrados.</p>'}</div>`;
}

function renderTimeline() {
  const list = [...S.historias].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  $('#timeline').innerHTML = list.map((h, i) => `
    <li class="tl-item">
      <span class="tl-mark">${i + 1}</span>
      <button class="tl-btn" data-world="${esc(h.id)}">
        <span class="tl-era">${esc(h.epoca || '')}</span>
        <h3>${esc(h.titulo)}</h3>
        <p>${esc(h.sinopsis)}</p>
      </button>
    </li>`).join('');
}

function setMvTab(tab) {
  ['mapa', 'cron', 'uni'].forEach(t => $('#tab-' + t).classList.toggle('active', t === tab));
  $('#mv-body').hidden = tab !== 'mapa';
  $('#timeline').hidden = tab !== 'cron';
  $('#mv-uni').hidden = tab !== 'uni';
  if (tab === 'uni') renderUniverso();
}

/* ============================================================
   MEDIA (openings, canciones, videos)
   ============================================================ */
const TIPOS = { todos: 'Todo', opening: 'Openings', ending: 'Endings', cancion: 'Canciones', video: 'Videos' };
let mediaFilter = 'todos';

function renderMedia() {
  const presentes = new Set(S.media.map(m => m.tipo));
  $('#media-filters').innerHTML = Object.entries(TIPOS)
    .filter(([k]) => k === 'todos' || presentes.has(k))
    .map(([k, label]) => `<button class="seg-btn ${k === mediaFilter ? 'active' : ''}" data-filter="${k}">${label}</button>`).join('');

  const items = S.media.filter(m => mediaFilter === 'todos' || m.tipo === mediaFilter);
  $('#media-grid').innerHTML = items.map((m) => {
    const thumb = m.youtube_id ? `https://img.youtube.com/vi/${encodeURIComponent(m.youtube_id)}/hqdefault.jpg` : m.miniatura;
    const h = storyById(m.historia);
    return `<button class="media-card" data-idx="${S.media.indexOf(m)}">
      <div class="media-thumb">${imgTag(thumb, m.titulo)}</div>
      <div class="media-body">
        <span class="tipo">${esc(TIPOS[m.tipo] || m.tipo)}${h ? ' - ' + esc(h.titulo) : ''}</span>
        <h3>${esc(m.titulo)}</h3>
        <p>${esc(m.descripcion || '')}</p>
      </div>
    </button>`;
  }).join('') || '<p class="hint">Aún no hay contenido en esta categoría.</p>';
}

function openMedia(idx) {
  const m = S.media[idx];
  if (!m) return;
  if (m.youtube_id && /^[\w-]{6,20}$/.test(m.youtube_id)) {
    $('#modal-frame').src = `https://www.youtube-nocookie.com/embed/${m.youtube_id}?autoplay=1&rel=0`;
    $('#modal').hidden = false;
  } else if (m.url) {
    window.open(safeUrl(m.url), '_blank', 'noopener');
  }
}
function closeModal() {
  $('#modal').hidden = true;
  $('#modal-frame').src = '';
}

/* ============================================================
   Eventos
   ============================================================ */
function bindEvents() {
  // Personajes
  $('#rail-list').addEventListener('click', e => { const b = e.target.closest('.rail-item'); if (b) selectStory(b.dataset.id); });
  $('#pj-thumbs').addEventListener('click', e => { const b = e.target.closest('.thumb'); if (b) selectChar(b.dataset.id); });
  $('#op-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) showOpinion(b.dataset.target); });
  $('#rail-up').onclick = () => stepStory(-1);
  $('#rail-down').onclick = () => stepStory(1);
  $('#thumb-prev').onclick = () => stepChar(-1);
  $('#thumb-next').onclick = () => stepChar(1);

  // Multiverso
  $('#mv-nodes').addEventListener('click', e => { const b = e.target.closest('.node'); if (b) selectWorld(b.dataset.id); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-world]');
    if (!b) return;
    if (b.closest('#timeline')) { setMvTab('mapa'); S.activeGroup = undefined; }
    selectWorld(b.dataset.world, b.closest('#mv-conn') ? S.activeGroup : undefined);
  });
  $('#mv-groups').addEventListener('click', e => {
    const b = e.target.closest('[data-group]');
    if (b) selectWorld(S.worldId, Number(b.dataset.group));
  });
  $('#tab-mapa').onclick = () => setMvTab('mapa');
  $('#tab-cron').onclick = () => setMvTab('cron');
  $('#tab-uni').onclick = () => setMvTab('uni');
  $('#mv-close').onclick = closeWorld;
  $('#mv-uni').addEventListener('click', e => {
    const u = e.target.closest('[data-uni]'), b = e.target.closest('[data-base]'), s = e.target.closest('[data-story]');
    if (u) renderUniverso(u.dataset.uni, null, 'historia');
    else if (b) renderUniverso(b.dataset.base, null, 'base');
    else if (s) renderUniverso(null, s.dataset.story, 'historia');
  });

  // Media
  $('#media-filters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { mediaFilter = b.dataset.filter; renderMedia(); } });
  $('#media-grid').addEventListener('click', e => { const b = e.target.closest('.media-card'); if (b) openMedia(Number(b.dataset.idx)); });
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  window.addEventListener('hashchange', route);
}

/* ============================================================
   Inicio de la app
   ============================================================ */
(async function init() {
  try {
    await loadData();
  } catch (err) {
    const box = $('#error');
    box.hidden = false;
    box.textContent = `${err.message}. Si abriste index.html con doble clic, no funciona: usa GitHub Pages o un servidor local (por ejemplo la extensión Live Server de VS Code).`;
    console.error(err);
    return;
  }
  renderInicio();
  renderNoticias();
  renderRail();
  renderMapa();
  renderTimeline();
  renderMedia();
  bindEvents();
  route();
})();
