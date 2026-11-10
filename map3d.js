/* Mapa 3D do The Forest: modelo girável com Three.js (r128) + OrbitControls.
   Coordenadas do mapa: x (0–26) da esquerda p/ direita, y (0–26) do fundo (palco) p/ frente (entrada), z para cima. */
function buildMap3D() {
  const host = document.getElementById('map3d');
  if (!host || !window.THREE || !THREE.OrbitControls) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UP = 1.8, YW = 15.4, R = .6, B = -1.3;
  const V = (x, y, z) => new THREE.Vector3(x - 13, z, y - 13);

  const scene = new THREE.Scene();
  const world = new THREE.Group(); scene.add(world);
  const mats = {};
  const lam = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  const glow = c => new THREE.MeshBasicMaterial({ color: c });

  function box(x, y, w, d, z0, h, color, parent = world) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? lam(color) : color);
    m.position.copy(V(x + w / 2, y + d / 2, z0 + h / 2)); parent.add(m); return m;
  }
  function plane(x, y, z, w, d, mat, lift = .01) { // plano deitado
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.copy(V(x + w / 2, y + d / 2, z + lift)); world.add(m); return m;
  }
  function prism(x, y, w, d, z1, r, color) { // telhado de duas águas com cumeeira em x
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(d, 0); sh.lineTo(d / 2, r); sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); g.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(g, lam(color)); m.position.copy(V(x + w, y, z1)); world.add(m); return m;
  }
  function tent(x, y, w, d, z0, h, r, roof = '#EEF1EA', walls = '#D3D9CE') {
    box(x, y, w, d, z0, h, walls);
    if (Array.isArray(roof)) { const n = roof.length; for (let i = 0; i < n; i++) prism(x + w * i / n, y, w / n, d, z0 + h, r, roof[i]); }
    else prism(x, y, w, d, z0 + h, r, roof);
  }

  /* ---------- texturas de texto ---------- */
  const FONT = 'Montserrat, Arial, sans-serif';
  function textTex(lines, wU, hU, o = {}) {
    const ppu = 128, cw = Math.round(wU * ppu), ch = Math.round(hU * ppu);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, cw, ch); }
    g.fillStyle = o.color || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const L = Array.isArray(lines) ? lines : [lines], sizes = o.sizes || L.map(() => 1);
    const tot = sizes.reduce((a, b) => a + b, 0); let yy = ch * .08;
    L.forEach((t, i) => {
      const band = ch * .84 * sizes[i] / tot; let fs = band * .8;
      const sp = o.ls ?? .12;
      const set = () => { g.font = `${o.w || 900} ${fs}px ${FONT}`; if ('letterSpacing' in g) g.letterSpacing = (fs * sp) + 'px'; };
      set(); while (g.measureText(t).width > cw * .9 && fs > 4) { fs -= 1; set(); }
      g.fillText(t, cw / 2 + (('letterSpacing' in g) ? fs * sp / 2 : 0), yy + band / 2); yy += band;
    });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }
  const texMat = (tex, op = 1) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false });
  function floorText(cx, cy, z, wU, hU, lines, o) { const p = plane(cx - wU / 2, cy - hU / 2, z, wU, hU, texMat(textTex(lines, wU, hU, o), o.op ?? 1), .09); p.renderOrder = 2; }
  function wallText(cx, yFront, zc, wU, hU, lines, o) { // texto numa face voltada para a frente (+y)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), texMat(textTex(lines, wU, hU, o)));
    m.position.copy(V(cx, yFront + .015, zc)); m.renderOrder = 2; world.add(m); }

  /* ---------- grade de contenção: painéis com barras verticais, cantos arredondados e pés em V (geometria real) ---------- */
  const fenceMat = new THREE.MeshLambertMaterial({ color: '#C3CCC8' }), footMat = new THREE.MeshLambertMaterial({ color: '#8E9895' });
  const barGeo = new THREE.BoxGeometry(.025, 1, .025), railGeo = new THREE.BoxGeometry(1, .04, .04), footGeo = new THREE.BoxGeometry(.035, 1, .035);
  const fenceParts = { bar: [], rail: [], foot: [] }, H = .62;
  const M4 = (pos, rotY, sx, sy, sz, rz = 0) => new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, rz)), new THREE.Vector3(sx, sy, sz));
  function fenceLine(x1, y1, x2, y2, z) {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 1.25)), ux = (x2 - x1) / len, uy = (y2 - y1) / len, rot = -Math.atan2(y2 - y1, x2 - x1);
    const P = (a, h) => V(x1 + ux * a, y1 + uy * a, z + h);
    for (let k = 0; k < n; k++) {
      const a0 = k / n * len + .05, a1 = (k + 1) / n * len - .05, w = a1 - a0, zb = .12;
      fenceParts.rail.push(M4(P((a0 + a1) / 2, H), rot, w - .1, 1, 1), M4(P((a0 + a1) / 2, zb), rot, w, 1, 1));
      fenceParts.bar.push(M4(P(a0, (zb + H - .05) / 2), rot, 1.6, H - zb - .05, 1.6), M4(P(a1, (zb + H - .05) / 2), rot, 1.6, H - zb - .05, 1.6));
      fenceParts.rail.push(M4(P(a0 + .03, H - .025), rot, .1, 1, 1, .8), M4(P(a1 - .03, H - .025), rot, .1, 1, 1, -.8));
      for (let a = a0 + .11; a < a1 - .06; a += .11) fenceParts.bar.push(M4(P(a, (zb + H) / 2), rot, 1, H - zb, 1));
      for (const a of [a0 + .16, a1 - .16]) for (const sd of [-1, 1]) {
        const base = P(a, 0); base.x += -uy * .12 * sd; base.z += ux * .12 * sd; // V(x,y,z) troca y↔z
        const top = P(a, zb), mid = base.clone().add(top).multiplyScalar(.5), L = base.distanceTo(top);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize());
        fenceParts.foot.push(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, L, 1)));
      }
    }
  }
  function buildFences() {
    [['bar', barGeo, fenceMat], ['rail', railGeo, fenceMat], ['foot', footGeo, footMat]].forEach(([k, g, m]) => {
      const list = fenceParts[k]; if (!list.length) return; const im = new THREE.InstancedMesh(g, m, list.length);
      list.forEach((mx, i) => im.setMatrixAt(i, mx)); world.add(im); });
  }

  /* ---------- terreno com fosso ---------- */
  const soil = new THREE.MeshLambertMaterial({ color: '#3B2A1B' }), grass = '#1A3D1E', ground = '#1B261B';
  box(0, 0, 26, 26, B, -B, soil);                                     // base de terra
  const ring = [[0, YW, 26, 26 - YW], [0, 0, 26, R], [0, R, R, YW - R], [26 - R, R, R, YW - R]];
  ring.forEach(([x, y, w, d]) => { box(x, y, w, d, 0, UP, '#3E2D1C'); plane(x, y, UP, w, d, lam(grass), .02); });
  plane(R, R, 0, 26 - 2 * R, YW - R, lam(ground), .02);                 // piso do fosso
  box(R, R + .01, 26 - 2 * R, .04, 0, UP - .005, '#566552');                    // parede do fundo
  box(R + .01, R, .04, YW - R, 0, UP - .005, '#43503F');                        // parede esquerda
  box(26 - R - .05, R, .04, YW - R, 0, UP - .005, '#43503F');                         // parede direita
  box(R, YW - .05, 26 - 2 * R, .04, 0, UP - .005, '#4B5A47');                         // parede do desnível
  plane(.3, YW, UP, 25.4, 10.3, lam(ground), .03);
  plane(0, YW, UP, 26, .25, lam('#8A9884'), .04);                       // borda de pedra

  /* setores */
  plane(6, 4.8, 0, 14, 9.8, lam('#6FE04F'), .06);                        // pista
  plane(.6, 16.2, UP, 9.6, 6, lam('#6FE04F'), .06);                      // pista superior
  plane(16, 18.6, UP, 9.6, 4.6, lam('#2F6A2C'), .06);                    // lounge (grama)
  plane(.6, 22.8, UP, 10.2, 2.8, lam('#3A483A'), .06);                   // banheiros + bar
  plane(15.4, 23.6, UP, 6.6, 2.4, lam('#2B382B'), .06);                  // acesso
  floorText(13, 8.6, 0, 11, 2.6, 'PISTA', { color: '#0B2A0B', op: .85, ls: .25 });
  floorText(5.4, 19.9, UP, 8, 2.4, ['PISTA', 'SUPERIOR'], { color: '#0B2A0B', op: .85, sizes: [1.7, 1], ls: .25 });

  /* ---------- palco ---------- */
  const sx0 = 7.6, sx1 = 18.4, sz = 1.3, fy = 1, fxm = 13, fTop = 7.6, TH = .55, FD = .4;
  box(sx0, .6, sx1 - sx0, 3.8, 0, sz, '#2C372C');
  box(sx0, 4.38, sx1 - sx0, .04, sz - .06, .06, glow('#7CFC5A'));
  const O = [[sx0 - .2, sz], [sx1 + .2, sz], [fxm, fTop]];
  const hb = (O[1][0] - O[0][0]) / 2, hh = fTop - sz, Ls = Math.hypot(hb, hh), rIn = hb * hh / (Ls + hb), kIn = (rIn - TH) / rIn;
  const IN = O.map(([x, z]) => [fxm + (x - fxm) * kIn, sz + rIn + (z - sz - rIn) * kIn]);
  const toShape = pts => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x - 13, z) : s.moveTo(x - 13, z)); s.closePath(); return s; };
  { const sh = toShape(O); const hole = new THREE.Path(); IN.forEach(([x, z], i) => i ? hole.lineTo(x - 13, z) : hole.moveTo(x - 13, z)); hole.closePath(); sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: FD, bevelEnabled: false }), lam('#9A6A38')); m.position.z = fy - 13; world.add(m);
    const back = new THREE.Mesh(new THREE.ShapeGeometry(toShape(IN)), lam('#0F1A0F')); back.position.z = fy - 13 + .01; world.add(back); }
  // varas de bambu
  const wood = lam('#B89060');
  for (let z = sz + .3; z < fTop - .4; z += .3) { const t = (z - sz) / (fTop - sz);
    const xl = sx0 + (fxm - sx0) * t - .3 - Math.random() * .7, xr = sx1 - (sx1 - fxm) * t + .3 + Math.random() * .7;
    box(xl, fy + .12, xr - xl, .05, z, .05, wood); }
  for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.3, .05), wood);
    m.position.copy(V(fxm + i * .22, fy + .2, fTop + .45)); m.rotation.z = -i * .28; world.add(m); }
  // lobo, letreiro e arco de luzes
  const loader = new THREE.TextureLoader();
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.6), new THREE.MeshBasicMaterial({ map: loader.load('wolf_t.png'), transparent: true, depthWrite: false }));
    m.position.copy(V(fxm, fy + .16, 3.4)); world.add(m); }
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.41), new THREE.MeshBasicMaterial({ map: loader.load('word_o.png'), transparent: true, depthWrite: false }));
    m.position.copy(V(fxm, fy + FD + .15, 5.87)); world.add(m); }
  const bulbs = [];
  for (let i = 0; i <= 26; i++) { const th = -Math.PI / 2 + Math.PI * i / 26, x = 13 + 5 * Math.sin(th), z = 1.5 + 5.6 * Math.cos(th);
    const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), glow('#B8FFF0')); b.position.copy(V(x, fy + .5, z)); world.add(b); bulbs.push(b); }
  // som, cabine e lança-chamas
  box(sx0 + .2, 3.4, .9, .9, sz, 2.6, '#151A15'); box(sx1 - 1.1, 3.4, .9, .9, sz, 2.6, '#151A15');
  box(11.5, 3.4, 3, .8, sz, .9, '#1F2A1F'); box(11.5, 4.19, 3, .03, sz + .5, .06, glow('#7CFC5A'));
  const flames = [];
  function fire(x, y, z, s = 1) { const g = new THREE.Group(); g.position.copy(V(x, y, z));
    const a = new THREE.Mesh(new THREE.ConeGeometry(.32 * s, 1.1 * s, 12), glow('#FF8A1F')); a.position.y = .55 * s;
    const b = new THREE.Mesh(new THREE.ConeGeometry(.18 * s, .7 * s, 12), glow('#FFC560')); b.position.y = .38 * s;
    g.add(a, b); world.add(g); flames.push(g); return g; }
  [[sx0 + 1.55], [sx1 - 1.55]].forEach(([x]) => { box(x - .25, 3.8, .5, .5, sz, .4, '#333'); fire(x, 4.05, sz + .4, 1); });
  // lasers
  const lasers = [];
  [[8.5, 13, 1.2], [12, 14, 1], [17.5, 13.5, 1.2], [14.5, 12.5, 1]].forEach(p => {
    const g = new THREE.BufferGeometry().setFromPoints([V(fxm, fy + .5, fTop - 1.2), V(...p)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#7CFC5A', transparent: true, opacity: .55 })); world.add(l); lasers.push({ l, p }); });
  // backstage e banheiros químicos
  tent(1, .9, 2.9, 2.4, 0, 1, .45); wallText(2.45, 3.3, .5, 2.6, .5, 'BACKSTAGE', { color: '#2A342A' });
  tent(18.95, .7, 2.6, 2.4, 0, 1, .45); wallText(20.25, 3.1, .5, 2.3, .5, 'BACKSTAGE', { color: '#2A342A' });
  for (let i = 0; i < 3; i++) box(21.9 + i * .92, .6, .8, .85, 0, 1.4, '#E3E8DF');
  wallText(23.22, 1.45, .7, 2.6, .45, 'BANHEIROS', { color: '#2A342A' });

  /* ---------- camarotes ---------- */
  const CH = .9, bay = 2.06, yA = 4.2, yB = 4.2 + bay * 5;
  [[.6, 1], [20.8, 6]].forEach(([x, first]) => {
    box(x, yA, 4.6, bay * 5, 0, CH, '#1F8A55');
    for (let i = 1; i < 5; i++) box(x, yA + i * bay - .02, 4.6, .04, CH, .01, '#0E3F27');
    for (let i = 0; i < 5; i++) floorText(x + 2.3, yA + i * bay + 1.05, CH, 1.4, 1.2, String(first + i), { color: '#EAFBE5', ls: 0 });
    for (let j = 0; j < 3; j++) box(x + 3 - (first > 1 ? 2.2 : 0), yB + j * .3, 1.2, .3, 0, CH * (1 - j / 3), '#6B7A68');
  });
  fenceLine(5.2, yA, 5.2, yB, CH); fenceLine(.6, yB, 5.2, yB, CH);
  fenceLine(20.8, yA, 20.8, yB, CH); fenceLine(20.8, yB, 25.4, yB, CH);
  for (let i = 1; i < 5; i++) { fenceLine(.6, yA + i * bay, 5.2, yA + i * bay, CH); fenceLine(20.8, yA + i * bay, 25.4, yA + i * bay, CH); }

  /* ---------- escada ---------- */
  const st = 7, ex0 = 11.2, ex1 = 14.8, sd = .72, L = st * sd;
  for (let i = 0; i < st; i++) { const y = YW - (i + 1) * sd, h = UP * (1 - i / st);
    box(ex0, y, ex1 - ex0, sd, 0, h, '#8A9884'); box(ex0, y + sd - .03, ex1 - ex0, .03, h - .01, .02, '#3E473A'); }
  [ex0 - .25, ex1].forEach(x => { // laterais inclinadas + corrimão
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, UP + .2); sh.lineTo(0, .2); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: .25, bevelEnabled: false }); g.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(g, lam('#5C6858')); m.position.copy(V(x + .25, YW - L, 0)); world.add(m);
    const rail = new THREE.BufferGeometry().setFromPoints([V(x + .12, YW - L, 1), V(x + .12, YW, UP + 1)]);
    world.add(new THREE.Line(rail, new THREE.LineBasicMaterial({ color: '#C9D2C4' }))); });
  fenceLine(.4, YW + .1, ex0 - .3, YW + .1, UP); fenceLine(ex1 + .3, YW + .1, 25.6, YW + .1, UP);
  function torch(x, y, z) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.2, 6), lam('#6B4A2A')); p.position.copy(V(x, y, z + .6)); world.add(p);
    fire(x, y, z + 1.15, .35); }
  torch(ex0 - .6, YW + .5, UP); torch(ex1 + .6, YW + .5, UP); torch(ex0 - .6, YW - L - .4, 0); torch(ex1 + .6, YW - L - .4, 0);

  /* ---------- nível superior ---------- */
  [[16, 'DRINKS'], [21, 'ALIMENTAÇÃO']].forEach(([x, t]) => { tent(x, 15.9, 4.6, 2, UP, 1.15, .6, '#9A7440', '#3A2A18');
    wallText(x + 2.3, 17.9, UP + .5, 4.2, .55, t, { color: '#7CFC5A', ls: .06 }); });
  // lounge
  const fx = 20.8, fyy = 21.1;
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, s = new THREE.Mesh(new THREE.DodecahedronGeometry(.16), lam(i % 2 ? '#8A8F86' : '#6E736B'));
    s.position.copy(V(fx + Math.cos(a) * .95, fyy + Math.sin(a) * .95, UP + .1)); world.add(s); }
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.2, 6), lam('#5A3A20'));
    l.position.copy(V(fx, fyy, UP + .15)); l.rotation.set(Math.PI / 2, 0, i * Math.PI / 3); world.add(l); }
  fire(fx, fyy, UP + .1, 1.3);
  const fireLight = new THREE.PointLight('#FF9A40', 1.4, 9, 2); fireLight.position.copy(V(fx, fyy, UP + 1.2)); world.add(fireLight);
  const sofa = (x, y, w, d) => { box(x, y, w, d, UP, .3, '#8A6436'); box(x + .1, y + .1, w - .2, d - .2, UP + .3, .2, '#1E241E'); };
  sofa(16.8, 19.2, 2.2, 1.1); sofa(22.6, 19.2, 2.2, 1.1); sofa(16.8, 21.4, 1.1, 1.6);
  [[19, 22.3], [22.6, 22.3], [24.6, 21.2]].forEach(([x, y]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .4, 10), lam('#A07A48')); c.position.copy(V(x + .25, y + .25, UP + .2)); world.add(c); });
  box(19.6, 23.05, 4.4, .15, UP + .15, .75, '#2A1C10'); wallText(21.8, 23.2, UP + .52, 4, .55, 'LOUNGE', { color: '#FFC560', ls: .35 });
  [[16.2, 19.4, 16.2, 22.6], [25.4, 19.4, 25.4, 22.6]].forEach(([x1, y1, x2, y2]) => {
    [[x1, y1], [x2, y2]].forEach(([x, y]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.6, 6), lam('#4A3320')); p.position.copy(V(x, y, UP + .8)); world.add(p); });
    for (let j = 1; j < 10; j++) { const t = j / 10, b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), glow('#FFE3A3'));
      b.position.copy(V(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, UP + 1.6 - Math.sin(t * Math.PI) * .45)); world.add(b); } });
  // banheiros e bar
  tent(.8, 23.1, 4, 2, UP, 1.2, .45);
  box(1.5, 25.09, .8, .02, UP, .55, '#3D6FE0'); box(3.2, 25.09, .8, .02, UP, .55, '#E05A8A');
  wallText(2.8, 25.1, UP + .88, 3.6, .45, 'BANHEIROS', { color: '#0A120A' });
  tent(5.4, 23.1, 5.2, 2, UP, 1.2, .45, ['#7CFC5A', '#F1F4EE', '#7CFC5A', '#F1F4EE', '#7CFC5A', '#F1F4EE', '#7CFC5A', '#F1F4EE']);
  wallText(8, 25.1, UP + .55, 4.5, .8, 'BAR', { color: '#0A120A', ls: .3 });
  // portal de entrada
  box(16.2, 25.1, .45, .45, UP, 2.7, '#5A4128'); box(20.75, 25.1, .45, .45, UP, 2.7, '#5A4128');
  box(16.2, 25.1, 5, .45, UP + 2.7, .9, '#2E6B34');
  for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(.18 + Math.random() * .15), lam(Math.random() < .5 ? '#2C8238' : '#35963F'));
    s.position.copy(V(16.3 + Math.random() * 4.8, 25.2 + Math.random() * .3, UP + 3.65 + Math.random() * .2)); world.add(s); }
  wallText(18.7, 25.55, UP + 3.15, 4.4, .65, 'ENTRADA', { color: '#F1F4EE', ls: .3 });

  buildFences();
  /* ---------- luz, câmera, controles ---------- */
  scene.add(new THREE.HemisphereLight('#E6F2E2', '#1A2A1A', .75));
  const sun = new THREE.DirectionalLight('#ffffff', .55); sun.position.set(14, 26, 18); scene.add(sun);
  const stageLight = new THREE.PointLight('#7CFC5A', .9, 16, 2); stageLight.position.copy(V(13, 6, 5)); world.add(stageLight);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
  camera.position.set(37, 32, 37);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -1.6, 0); controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = .35; controls.maxPolarAngle = 1.3; controls.rotateSpeed = .6;
  let dragging = false, lastTouch = 0;
  controls.addEventListener('start', () => { dragging = true; host.classList.add('is-dragging'); });
  controls.addEventListener('end', () => { dragging = false; lastTouch = performance.now(); host.classList.remove('is-dragging'); });

  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 600 ? 40 : 30; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();

  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    if (!reduce) {
      const idle = !dragging && performance.now() - lastTouch > 1500;
      world.position.y = Math.sin(t * .9) * .35;                         // flutuação
      if (idle) { world.rotation.y += (Math.sin(t * .22) * .07 - world.rotation.y) * .02; world.rotation.x = Math.sin(t * .5) * .012; }
      flames.forEach((f, i) => { const k = 1 + Math.sin(t * 9 + i * 1.7) * .08 + Math.sin(t * 13 + i) * .05; f.scale.set(1, k, 1); });
      fireLight.intensity = 1.3 + Math.sin(t * 11) * .2 + Math.sin(t * 7) * .15;
      bulbs.forEach((b, i) => b.material.color.setHSL(.47, .9, .72 + Math.sin(t * 3 - i * .5) * .12));
      lasers.forEach(({ l, p }, i) => { const pos = l.geometry.attributes.position; const q = V(p[0] + Math.sin(t * .8 + i) * 1.6, p[1], p[2]);
        pos.setXYZ(1, q.x, q.y, q.z); pos.needsUpdate = true; });
    }
    controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick);
  }
  host.classList.add('is-ready'); tick();
}
// espera a fonte para desenhar os textos com a Montserrat
(document.fonts ? Promise.all([document.fonts.load('900 40px Montserrat'), document.fonts.load('700 40px Montserrat')]).catch(() => {}) : Promise.resolve())
  .then(buildMap3D, buildMap3D);
