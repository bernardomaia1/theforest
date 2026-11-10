/* The Forest — viagem 3D controlada pela rolagem (Three.js r128).
   Cenas: 1) lobo-escultura na clareira  2) desmontagem coreografada  3) passagem por triângulos  4) palco flutuante.
   Recursos usados: wolf_t.png e word_t.png (logo da marca). Nenhum modelo externo: toda a geometria é gerada aqui.
   Para trocar o lobo por um modelo GLB próprio, substitua buildWolf() mantendo a lista `pieces`. */
(function () {
  var root = document.documentElement, journey = document.getElementById('journey'), canvasHost = document.getElementById('gl');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
  var progressEl = document.getElementById('intro-pct');
  function emitProgress(v) { if (progressEl) progressEl.textContent = Math.round(v * 100) + '%'; }
  function ready() { window.dispatchEvent(new Event('tf-ready')); }

  if (!journey || !canvasHost || !window.THREE) { root.classList.add('no-gl'); emitProgress(1); ready(); return; }
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { root.classList.add('no-gl'); emitProgress(1); ready(); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor('#070d08');
  canvasHost.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var FOG = new THREE.Color('#0b160d');
  scene.fog = new THREE.FogExp2(FOG, 0.034);

  // fundo com variação suave de luminosidade
  (function () {
    var c = document.createElement('canvas'); c.width = 4; c.height = 256; var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#030604'); gr.addColorStop(.55, '#0d1b10'); gr.addColorStop(.68, '#16281a'); gr.addColorStop(1, '#070d08');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); scene.background = new THREE.CanvasTexture(c);
  })();

  function radialTex(inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  // brilho gerado pixel a pixel (cor sempre branca, só o alfa varia): evita o chuvisco colorido no Safari do iPhone
  var glowTex = (function () { var N = 64, d = new Uint8Array(N * N * 4);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var dx = (x + .5) / N * 2 - 1, dy = (y + .5) / N * 2 - 1, r = Math.min(1, Math.sqrt(dx * dx + dy * dy)), a = Math.pow(1 - r, 2), i = (y * N + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(a * 255); }
    var t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
  // brilho calculado no próprio shader (sem textura): liso em qualquer aparelho, inclusive no Safari do iPhone
  var glows = [], glowGeo = new THREE.PlaneGeometry(1, 1);
  function glowSprite(color, size, opacity) {
    var m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { c: { value: new THREE.Color(color) }, op: { value: opacity } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'precision highp float;uniform vec3 c;uniform float op;varying vec2 vUv;void main(){float r=clamp(length(vUv*2.-1.),0.,1.);float a=(1.-r)*(1.-r)*op;gl_FragColor=vec4(c,a);}' });
    m.opacity = opacity;
    var s = new THREE.Mesh(glowGeo, m); s.scale.set(size, size, 1); s.renderOrder = 5; glows.push(s); return s;
  }

  /* ---------- luz ---------- */
  var amb = new THREE.HemisphereLight('#c9dcc4', '#0e180e', .45); scene.add(amb);
  var key = new THREE.DirectionalLight('#eef4ea', 0); key.position.set(5, 9, 10); scene.add(key);
  var wolfSpot = new THREE.SpotLight('#f2f8ee', 0, 26, .42, .7, 1.1); wolfSpot.position.set(2.5, 9, 9); wolfSpot.target.position.set(0, 3.2, 0); scene.add(wolfSpot, wolfSpot.target);
  var rim = new THREE.DirectionalLight('#7CFC5A', 1.5); rim.position.set(-4, 6, -9); scene.add(rim);
  var rim2 = new THREE.DirectionalLight('#9fffe0', .5); rim2.position.set(6, 3, -6); scene.add(rim2);

  /* ---------- chão, pedra e mata ao fundo ---------- */
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), new THREE.MeshStandardMaterial({ color: '#0c160d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -20; scene.add(ground);

  function rock(r, sx, sy, sz, color) {
    var g = new THREE.DodecahedronGeometry(r, 1), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), h = Math.abs(Math.sin(Math.round(X * 100) * 12.9898 + Math.round(Y * 100) * 78.233 + Math.round(Z * 100) * 37.719) * 43758.5453) % 1, k = 1 + h * .14; p.setXYZ(i, X * k, Y * k, Z * k); }
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: color || '#2b322a', roughness: .95, flatShading: true }));
    m.scale.set(sx, sy, sz); return m;
  }
  var pedestal = rock(1.6, 1.7, .62, 1.3, '#3a4237'); pedestal.position.set(0, .35, 0); scene.add(pedestal);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; scene.add(shadow);

  var treeMat = new THREE.MeshStandardMaterial({ color: '#0f2213', roughness: 1, flatShading: true });
  var nTrees = mobile ? 40 : 90;
  for (var t = 0; t < nTrees; t++) {
    var side = t % 2 ? 1 : -1, x = side * (7 + Math.random() * 18), z = 12 - Math.random() * 75, h = 5 + Math.random() * 7;
    var tr = new THREE.Mesh(new THREE.ConeGeometry(1 + Math.random() * 1.2, h, 6), treeMat); tr.position.set(x, h / 2, z); scene.add(tr);
  }
  for (var r = 0; r < 14; r++) { var rk = rock(.6 + Math.random() * .8, 1.3, .6, 1); rk.position.set((Math.random() - .5) * 24, .15, 6 - Math.random() * 60); scene.add(rk); }

  /* ---------- protagonista: lobo facetado em peças ---------- */
  var S = .022, BASE = 1.0;
  var outline = [[100,202],[80,188],[66,170],[58,152],[44,142],[50,130],[36,120],[46,108],[34,96],[46,88],[40,66],[52,10],[76,52],[100,47],[124,52],[148,10],[160,66],[154,88],[166,96],[154,108],[164,120],[150,130],[156,142],[142,152],[134,170],[120,188]];
  function inside(px, py) { var c = false; for (var i = 0, j = outline.length - 1; i < outline.length; j = i++) { var a = outline[i], b = outline[j];
    if (((a[1] > py) !== (b[1] > py)) && (px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }
  function height(px, py) { // relevo do rosto em pixels do desenho
    var nx = (px - 100) / 62, ny = (py - 112) / 92, z = 20 * Math.sqrt(Math.max(0, 1 - nx * nx * .85 - ny * ny * .6));
    if (py > 96) z += 24 * Math.exp(-Math.pow((px - 100) / 17, 2)) * Math.min(1, (py - 96) / 54);
    z += 5 * Math.exp(-Math.pow((py - 88) / 7, 2));
    z -= 7 * Math.exp(-((px - 76) * (px - 76) + (py - 98) * (py - 98)) / 110) + 7 * Math.exp(-((px - 124) * (px - 124) + (py - 98) * (py - 98)) / 110);
    if (py < 60) z = 6 + (60 - py) * .05;
    return z;
  }
  function delaunay(pts) { // Bowyer–Watson simples
    var big = [[-1e4, -1e4], [1e4, -1e4], [0, 1e4]], P = pts.concat(big), n = pts.length, tris = [[n, n + 1, n + 2]];
    function circ(t) { var a = P[t[0]], b = P[t[1]], c = P[t[2]], d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      var ux = ((a[0] * a[0] + a[1] * a[1]) * (b[1] - c[1]) + (b[0] * b[0] + b[1] * b[1]) * (c[1] - a[1]) + (c[0] * c[0] + c[1] * c[1]) * (a[1] - b[1])) / d;
      var uy = ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b[0]) + (b[0] * b[0] + b[1] * b[1]) * (a[0] - c[0]) + (c[0] * c[0] + c[1] * c[1]) * (b[0] - a[0])) / d;
      return [ux, uy, (a[0] - ux) * (a[0] - ux) + (a[1] - uy) * (a[1] - uy)]; }
    tris = tris.map(function (t) { return { v: t, c: circ(t) }; });
    for (var i = 0; i < n; i++) { var p = P[i], bad = [], keep = [];
      tris.forEach(function (t) { var dx = p[0] - t.c[0], dy = p[1] - t.c[1]; (dx * dx + dy * dy < t.c[2] ? bad : keep).push(t); });
      var edges = {}; bad.forEach(function (t) { for (var e = 0; e < 3; e++) { var a = t.v[e], b = t.v[(e + 1) % 3], k = a < b ? a + '_' + b : b + '_' + a; edges[k] = edges[k] ? 0 : [a, b]; } });
      tris = keep; for (var k in edges) if (edges[k]) { var tv = [edges[k][0], edges[k][1], i]; tris.push({ v: tv, c: circ(tv) }); } }
    return tris.map(function (t) { return t.v; }).filter(function (v) { return v[0] < n && v[1] < n && v[2] < n; });
  }
  var pieces = [], wolf = new THREE.Group(); scene.add(wolf);
  (function buildWolf() {
    var pts = outline.slice(), step = mobile ? 15 : 12;
    for (var i = 0; i < outline.length; i++) { var a = outline[i], b = outline[(i + 1) % outline.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (var s = step; s < L - step * .5; s += step) pts.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]); }
    for (var y = 14; y < 200; y += step) for (var x = 36; x < 166; x += step) {
      var jx = x + (Math.sin(x * 3.1 + y) * .5) * step * .55, jy = y + (Math.cos(y * 2.3 + x) * .5) * step * .55;
      if (inside(jx, jy)) { var ok = true; for (var q = 0; q < outline.length; q++) if (Math.hypot(outline[q][0] - jx, outline[q][1] - jy) < step * .55) ok = false; if (ok) pts.push([jx, jy]); } }
    [[76, 98], [124, 98], [100, 150], [100, 120], [88, 106], [112, 106]].forEach(function (p) { pts.push(p); });
    var tris = delaunay(pts).filter(function (t) { var cx = (pts[t[0]][0] + pts[t[1]][0] + pts[t[2]][0]) / 3, cy = (pts[t[0]][1] + pts[t[1]][1] + pts[t[2]][1]) / 3; return inside(cx, cy); });
    var shades = ['#3a4337', '#444e40', '#333b30', '#4b5546', '#2d342a'].map(function (c) { return new THREE.MeshStandardMaterial({ color: c, roughness: .82, metalness: .08, flatShading: true }); });
    var TH = .22;
    tris.forEach(function (t, idx) {
      var V = t.map(function (k) { var p = pts[k]; return new THREE.Vector3((p[0] - 100) * S, BASE + (202 - p[1]) * S, height(p[0], p[1]) * S); });
      var c = V[0].clone().add(V[1]).add(V[2]).multiplyScalar(1 / 3);
      var L = V.map(function (v) { return v.clone().sub(c); });
      var pos = [], back = L.map(function (v) { return new THREE.Vector3(v.x, v.y, v.z - TH); });
      function tri(a, b, d) { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z); }
      // garante a face frontal virada para +z
      var nrm = new THREE.Vector3().subVectors(L[1], L[0]).cross(new THREE.Vector3().subVectors(L[2], L[0]));
      if (nrm.z < 0) { L = [L[0], L[2], L[1]]; back = [back[0], back[2], back[1]]; }
      tri(L[0], L[1], L[2]); tri(back[0], back[2], back[1]);
      for (var e = 0; e < 3; e++) { var a = L[e], b = L[(e + 1) % 3], a2 = back[e], b2 = back[(e + 1) % 3]; tri(a, a2, b); tri(b, a2, b2); }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      var m = new THREE.Mesh(g, shades[idx % shades.length]); m.position.copy(c); wolf.add(m);
      var dx = c.x, dy = c.y - 3.3, dist = Math.min(1, Math.hypot(dx, dy) / 2.6);
      var dir = new THREE.Vector3(dx, dy * .8, .35 + Math.random() * .5).normalize();
      if (Math.abs(dx) < .7 && Math.abs(dy) < 1.4) dir.x += (dx < 0 ? -1 : 1) * 1.2; // abre o centro para a câmera passar
      pieces.push({ m: m, home: c.clone(), dir: dir.normalize(), delay: (1 - dist) * .45 + Math.random() * .08, dist: 1.6 + dist * 1.9 + Math.random() * .5,
        rot: new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4, (Math.random() - .5) * .8) });
    });
  })();
  // olhos e núcleo: ficam no centro durante a desmontagem
  var EYE_Y = BASE + (202 - 98) * S, eyes = [], eyeLight = new THREE.PointLight('#7CFC5A', 1.2, 6, 2);
  eyeLight.position.set(0, EYE_Y, .9); scene.add(eyeLight);
  [-1, 1].forEach(function (sd) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 12), new THREE.MeshBasicMaterial({ color: '#C9FFB8' }));
    e.position.set(sd * 24 * S, EYE_Y, height(100 + sd * 24, 98) * S + .03); scene.add(e);
    var gl = glowSprite('#7CFC5A', .9, .9); gl.position.copy(e.position); scene.add(gl); eyes.push(e, gl); });
  var core = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 0), new THREE.MeshStandardMaterial({ color: '#0d1a0f', emissive: '#2f8a2a', emissiveIntensity: .6, metalness: .9, roughness: .18, flatShading: true }));
  core.position.set(0, EYE_Y - .3, .2); core.scale.setScalar(.001); scene.add(core);
  var coreGlow = glowSprite('#7CFC5A', 3.2, 0); coreGlow.position.copy(core.position); scene.add(coreGlow);

  /* ---------- passagem: triângulos concêntricos ---------- */
  var rings = [], RING_Z0 = -5, RING_N = 9, RING_GAP = 3.4;
  function triShape(R) { var s = new THREE.Shape(); for (var i = 0; i < 3; i++) { var a = Math.PI / 2 + i * Math.PI * 2 / 3, x = Math.cos(a) * R, y = Math.sin(a) * R; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; }
  var ringMat = new THREE.MeshStandardMaterial({ color: '#36412f', roughness: .7, metalness: .2, flatShading: true });
  var edgeMat = new THREE.MeshBasicMaterial({ color: '#7CFC5A', transparent: true, opacity: .85 });
  for (var i = 0; i < RING_N; i++) {
    var R = 3.4 + (i % 3) * .25, sh = triShape(R), hole = new THREE.Path(), ri = R - .42;
    for (var k = 0; k < 3; k++) { var a = Math.PI / 2 + k * Math.PI * 2 / 3; k ? hole.lineTo(Math.cos(a) * ri, Math.sin(a) * ri) : hole.moveTo(Math.cos(a) * ri, Math.sin(a) * ri); } hole.closePath(); sh.holes.push(hole);
    var ring = new THREE.Group();
    ring.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .5, bevelEnabled: false }), ringMat));
    var es = triShape(ri + .07), eh = new THREE.Path();
    for (var k2 = 0; k2 < 3; k2++) { var a2 = Math.PI / 2 + k2 * Math.PI * 2 / 3, r2 = ri - .01; k2 ? eh.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2) : eh.moveTo(Math.cos(a2) * r2, Math.sin(a2) * r2); } eh.closePath(); es.holes.push(eh);
    var edge = new THREE.Mesh(new THREE.ShapeGeometry(es), edgeMat); edge.position.z = .52;
    ring.add(edge);
    ring.position.set(0, EYE_Y + .9, RING_Z0 - i * RING_GAP); ring.rotation.z = i * .12; ring.userData.base = i * .12; scene.add(ring); rings.push(ring);
  }
  var tunnelLight = new THREE.PointLight('#7CFC5A', 0, 18, 1.5); scene.add(tunnelLight);

  /* ---------- revelação: o palco do The Forest (mesma estrutura do mapa e da foto do evento) ---------- */
  var STAGE_Z = RING_Z0 - RING_N * RING_GAP - 10, stage = new THREE.Group(); stage.position.set(0, 0, STAGE_Z); scene.add(stage);
  var M = function (c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, flatShading: true }, o || {})); };
  var DZ = 1.1, SW = 8.4; // altura e largura do tablado
  function sbox(w, h, d, x, y, z, m) { var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); stage.add(b); return b; }
  // tablado apoiado no chão + faixa neon
  sbox(SW, DZ, 3.4, 0, DZ / 2, 0, M('#2b352b'));
  sbox(SW, .05, .05, 0, DZ - .03, 1.72, new THREE.MeshBasicMaterial({ color: '#7CFC5A' }));
  var shadowS = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.8)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadowS.rotation.x = -Math.PI / 2; shadowS.position.y = .02; stage.add(shadowS);
  // pirâmide: moldura grossa de madeira
  var wood = M('#9A6A38'), bamboo = M('#B89060'), FB = -1.2, TOP = 7.2, HW = 4.4;
  (function () {
    function tri(hw, base, top) { var s = new THREE.Shape(); s.moveTo(-hw, base); s.lineTo(hw, base); s.lineTo(0, top); s.closePath(); return s; }
    var outer = tri(HW, DZ, TOP), th = .3, k = (TOP - DZ - th * 3) / (TOP - DZ), inner = new THREE.Path();
    inner.moveTo(-HW * k + th * .2, DZ + th * .6); inner.lineTo(HW * k - th * .2, DZ + th * .6); inner.lineTo(0, DZ + th * .6 + (TOP - DZ) * k); inner.closePath(); outer.holes.push(inner);
    var frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .45, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 1 }), wood);
    frame.position.z = FB; stage.add(frame);
    var back = new THREE.Mesh(new THREE.ShapeGeometry(tri(HW * .96, DZ, TOP - .2)), M('#0f1a0f', { roughness: 1 })); back.position.z = FB - .02; stage.add(back);
    // varas de bambu horizontais, irregulares, saindo pelas bordas
    for (var y = DZ + .35; y < TOP - .5; y += .3) { var t = (y - DZ) / (TOP - DZ), half = HW * (1 - t) + .25 + Math.random() * .45, off = (Math.random() - .5) * .35;
      var b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, half * 2, 5), bamboo); b.rotation.z = Math.PI / 2 + (Math.random() - .5) * .04; b.position.set(off, y, FB + .12); stage.add(b); }
    // feixe de pontas no topo
    for (var i = -3; i <= 3; i++) { var sp = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, 1.5, 5), bamboo); sp.position.set(i * .12, TOP + .55, FB + .2); sp.rotation.z = -i * .26; stage.add(sp); }
  })();
  // letreiro FOREST em placa preta, lobo neon e arco de luzes
  var loader = new THREE.TextureLoader(), nLoaded = 0;
  function done() { nLoaded++; emitProgress(.6 + nLoaded * .2); if (nLoaded === 2) setTimeout(ready, 60); }
  var wolfT = loader.load('wolf_t.png', done, undefined, done), wordT = loader.load('word_o.png', done, undefined, done);
  var add = function (tex, w, h, x, y, z) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, y, z); stage.add(m); return m; };
  var sign = add(wordT, 3.5, 1.2, 0, 5.05, FB + .62); sign.material.blending = THREE.NormalBlending;
  add(wolfT, 2.2, 2.8, 0, 2.95, FB + .3);
  var bulbs2 = [];
  for (var i = 0; i <= 26; i++) { var th = -Math.PI / 2 + Math.PI * i / 26, x = 4.7 * Math.sin(th), y = DZ + .35 + 5.6 * Math.cos(th);
    var bl = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#B8FFF0' })); bl.position.set(x, y, FB + .5); stage.add(bl); bulbs2.push(bl);
    var bg = glowSprite('#5CFFE0', .7, .4); bg.position.copy(bl.position); stage.add(bg); }
  // caixas de som, cabine do DJ e lança-chamas no tablado
  [-3.4, 3.4].forEach(function (x) { sbox(.9, 2.4, .9, x, DZ + 1.2, .3, M('#141914')); });
  sbox(2.6, .9, .8, 0, DZ + .45, .9, M('#1f2a1f')); sbox(2.6, .05, .03, 0, DZ + .7, 1.31, new THREE.MeshBasicMaterial({ color: '#7CFC5A' }));
  var stageFire = [];
  function fire(x, y, z, s) {
    var g = new THREE.Group(); g.position.set(x, y, z);
    var a = new THREE.Mesh(new THREE.ConeGeometry(.22 * s, .9 * s, 10), new THREE.MeshBasicMaterial({ color: '#FF8A1F' })); a.position.y = .45 * s;
    var b = new THREE.Mesh(new THREE.ConeGeometry(.12 * s, .55 * s, 10), new THREE.MeshBasicMaterial({ color: '#FFC560' })); b.position.y = .3 * s;
    var gl = glowSprite('#FF9A40', 2.2 * s, .55); gl.position.y = .5 * s;
    g.add(a, b, gl); return g; }
  [-2.2, 2.2].forEach(function (x) { sbox(.45, .35, .45, x, DZ + .17, 1.2, M('#333')); var f = fire(x, DZ + .35, 1.2, 1); stage.add(f); stageFire.push(f); });
  var stageKey = new THREE.SpotLight('#e8f3e2', .8, 30, .6, .6, 1.2); stageKey.position.set(3, 10, 9); stageKey.target.position.set(0, 3, 0); stage.add(stageKey, stageKey.target);
  var fireLight = new THREE.PointLight('#FF9A40', 1.2, 10, 2); fireLight.position.set(0, DZ + 1.2, 2); stage.add(fireLight);
  var stageGlow = glowSprite('#7CFC5A', 11, .12); stageGlow.position.set(0, 3.6, FB - .6); stage.add(stageGlow);

  /* ---------- partículas ---------- */
  var NP = mobile ? 160 : 420, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP * 3), seeds = new Float32Array(NP);
  for (var q = 0; q < NP; q++) { pp[q * 3] = (Math.random() - .5) * 26; pp[q * 3 + 1] = Math.random() * 9; pp[q * 3 + 2] = 16 - Math.random() * 80; seeds[q] = Math.random() * 6.28; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  var particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#B8FFB0', size: mobile ? .05 : .04, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(particles);

  /* ---------- câmera: quadros-chave ao longo da rolagem ---------- */
  var camera = new THREE.PerspectiveCamera(mobile ? 52 : 38, 1, .1, 300);
  var EY = EYE_Y, RZ = RING_Z0 - (RING_N - 1) * RING_GAP;
  function keys() { var m = innerWidth / innerHeight < .9, f = m ? 1.45 : 1, sx = m ? .25 : 1; return [
    { p: 0.00, pos: [0, EY + .3, 14 * f], look: [0, EY - .4, 0] },
    { p: 0.12, pos: [0, EY + .2, 11.5 * f], look: [0, EY - .2, 0] },
    { p: 0.24, pos: [1.4 * sx, EY + .3, 10 * f], look: [0, EY, 0] },
    { p: 0.42, pos: [.6 * sx, EY + .1, 6.2 * f], look: [0, EY, 0] },
    { p: 0.50, pos: [0, EY, 3.2], look: [0, EY + .3, -6] },
    { p: 0.72, pos: [0, EY + .6, RZ - 1], look: [0, EY + .2, STAGE_Z] },
    { p: 0.84, pos: [0, 4.2, STAGE_Z + 15 * f], look: [m ? 0 : 2.6, 3.6, STAGE_Z] },
    { p: 1.00, pos: [-1.6 * sx, 4, STAGE_Z + 13 * f], look: [m ? 0 : 3, 3.7, STAGE_Z] } ]; }
  var K = keys(), smooth = function (t) { return t * t * (3 - 2 * t); };
  function sample(p) {
    for (var i = 0; i < K.length - 1; i++) if (p <= K[i + 1].p) { var a = K[i], b = K[i + 1], t = smooth((p - a.p) / (b.p - a.p));
      return { pos: new THREE.Vector3().fromArray(a.pos).lerp(new THREE.Vector3().fromArray(b.pos), t), look: new THREE.Vector3().fromArray(a.look).lerp(new THREE.Vector3().fromArray(b.look), t) }; }
    var l = K[K.length - 1]; return { pos: new THREE.Vector3().fromArray(l.pos), look: new THREE.Vector3().fromArray(l.look) };
  }
  var camPos = sample(0).pos.add(new THREE.Vector3(0, .8, 8)), camLook = sample(0).look, target = 0, prog = 0;

  /* ---------- interação ---------- */
  var mouse = new THREE.Vector2(0, 0), mouseS = new THREE.Vector2(0, 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hot = 0, hotT = 0;
  if (!mobile) addEventListener('pointermove', function (e) { mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); ndc.set(mouse.x, -mouse.y); });
  function hitStage(x, y) { ndc.set(x, y); ray.setFromCamera(ndc, camera); return ray.intersectObject(stage, true).length > 0; }
  renderer.domElement.addEventListener('click', function (e) { if (prog > .78 && hitStage(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1))) hotT = hotT ? 0 : 1; });
  addEventListener('touchend', function (e) { if (prog < .78) return; var t = e.changedTouches[0]; if (hitStage(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight * 2 - 1))) hotT = hotT ? 0 : 1; }, { passive: true });

  /* ---------- rolagem ---------- */
  function scrollP() { var span = Math.max(1, journey.offsetHeight - innerHeight); return Math.max(0, Math.min(1, -journey.getBoundingClientRect().top / span)); }
  var copies = [].slice.call(document.querySelectorAll('[data-from]'));
  var copyLayer = document.querySelector('.copy-layer');
  function updateCopy(p) { copies.forEach(function (c) { var a = +c.dataset.from, b = +c.dataset.to, f = .04;
      var o = Math.max(0, Math.min(1, Math.min((p - a) / f + 1, (b - p) / f + 1))); if (a <= 0 && p < b) o = Math.min(1, (b - p) / f + 1);
      c.style.opacity = o; c.style.transform = 'translateY(' + ((1 - o) * 14) + 'px)'; c.style.visibility = o > .01 ? 'visible' : 'hidden'; }); }
  // âncoras de navegação dentro da viagem
  function placeAnchors() { var span = journey.offsetHeight - innerHeight;
    [].slice.call(journey.querySelectorAll('[data-at]')).forEach(function (a) { a.style.top = (+a.dataset.at * span) + 'px'; }); }

  function resize() { var w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < .9 ? 52 : 38; camera.updateProjectionMatrix(); K = keys(); placeAnchors(); }
  addEventListener('resize', resize); resize();

  /* ---------- quadro a quadro ---------- */
  var clock = new THREE.Clock(), entry = reduce ? 1 : 0, started = false, visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });
  window.addEventListener('tf-start', function () { started = true; });
  if (root.classList.contains('ui-in')) started = true; // o sinal pode ter chegado antes deste script
  var tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  function frame() {
    requestAnimationFrame(frame);
    var jr = journey.getBoundingClientRect(), onScreen = jr.bottom > -innerHeight * .2;
    // os textos da viagem somem quando ela termina, antes da próxima parte do site
    var leave = Math.max(0, Math.min(1, (jr.bottom - innerHeight * .35) / (innerHeight * .45)));
    copyLayer.style.opacity = leave; copyLayer.style.visibility = leave > .01 ? 'visible' : 'hidden';
    canvasHost.style.visibility = onScreen ? 'visible' : 'hidden';
    if (!visible || !onScreen) return;
    var dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    target = scrollP(); prog += (target - prog) * (reduce ? 1 : Math.min(1, dt * 3.2)); // inércia da câmera
    if (Math.abs(target - prog) < .0004) prog = target;
    if (started && entry < 1) entry = Math.min(1, entry + dt / 2.4);
    var e = smooth(entry);
    updateCopy(prog);

    // câmera: rolagem + entrada + leve perspectiva pelo cursor (camadas separadas)
    var s = sample(prog);
    s.pos.add(tmpV.set(0, .8 * (1 - e), 8 * (1 - e)));
    mouseS.lerp(mouse, Math.min(1, dt * 2.2));
    var par = mobile || reduce ? 0 : (1 - Math.max(0, (prog - .46) / .06) * (prog < .74 ? 1 : 0)) ;
    par = Math.max(0, Math.min(1, par));
    camPos.copy(s.pos).add(tmpV.set(mouseS.x * .55 * par, -mouseS.y * .3 * par, 0));
    camLook.copy(s.look);
    camera.position.copy(camPos); camera.lookAt(camLook);

    // luz de entrada
    key.intensity = .7 * e; wolfSpot.intensity = 1.1 * e; amb.intensity = .22 + .16 * e;

    // desmontagem (0.22 → 0.47)
    var ex = Math.max(0, Math.min(1, (prog - .22) / .25));
    pieces.forEach(function (pc) {
      var k = smooth(Math.max(0, Math.min(1, (ex - pc.delay) / (1 - .45))));
      pc.m.position.copy(pc.home).addScaledVector(pc.dir, k * pc.dist);
      pc.m.rotation.set(pc.rot.x * k, pc.rot.y * k, pc.rot.z * k);
    });
    var floatY = reduce ? 0 : Math.sin(t * .55) * .06;
    wolf.position.y = floatY * (1 - ex); wolf.rotation.y = reduce ? 0 : Math.sin(t * .23) * .04 * (1 - ex);
    var ce = smooth(Math.max(0, Math.min(1, (ex - .3) / .7)));
    core.scale.setScalar(.001 + ce); core.rotation.y = t * .3; core.rotation.x = t * .17; core.position.y = EYE_Y - .3 + floatY;
    coreGlow.material.opacity = ce * .45;
    eyeLight.intensity = (.6 + .8 * e) * (1 - Math.max(0, (prog - .55) / .1));

    // passagem
    var pass = Math.max(0, Math.min(1, (prog - .48) / .26));
    rings.forEach(function (rg, i) { rg.rotation.z = rg.userData.base + (reduce ? 0 : Math.sin(t * .2 + i) * .05) + pass * (i % 2 ? .25 : -.25); });
    edgeMat.opacity = .9 * Math.min(1, Math.max(0, (prog - .4) / .1)); rings.forEach(function (rg) { rg.visible = prog > .38 && rg.position.z < camera.position.z - .6; });
    tunnelLight.position.set(0, EY + .6, camPos.z - 3); tunnelLight.intensity = 2 * Math.sin(Math.min(1, pass) * Math.PI);
    scene.fog.density = .034 - .012 * Math.sin(pass * Math.PI) - .008 * Math.max(0, (prog - .78) / .22);

    // palco flutuante
    bulbs2.forEach(function (b, i) { b.material.color.setHSL(.47, .9, .7 + (reduce ? 0 : Math.sin(t * 3 - i * .5) * .15)); });
    if (!mobile && prog > .78) { ray.setFromCamera(ndc, camera); hotT = ray.intersectObject(stage, true).length ? 1 : (hotT && !mobile ? 0 : hotT); }
    hot += (hotT - hot) * Math.min(1, dt * 4);
    stageFire.forEach(function (f, i) { var k = 1 + hot * .9 + (reduce ? 0 : Math.sin(t * 9 + i * 2) * .08 + Math.sin(t * 13 + i) * .05); f.scale.set(1 + hot * .3, k, 1 + hot * .3); });
    fireLight.intensity = .7 + hot * 1.4 + (reduce ? 0 : Math.sin(t * 11) * .15);
    stageGlow.material.opacity = .1 + hot * .18;

    // partículas lentas
    if (!reduce) { var ps = pg.attributes.position; for (var i = 0; i < NP; i++) { var y = ps.getY(i) + dt * .08; if (y > 9) y = 0; ps.setY(i, y); ps.setX(i, ps.getX(i) + Math.sin(t * .3 + seeds[i]) * dt * .03); } ps.needsUpdate = true; }

    var cq = camera.quaternion; for (var gi = 0; gi < glows.length; gi++) { var gq = glows[gi]; gq.quaternion.copy(cq); if (gq.parent && gq.parent !== scene) { gq.parent.getWorldQuaternion(tmpQ); gq.quaternion.premultiply(tmpQ.invert()); } gq.material.uniforms.op.value = gq.material.opacity; }
    renderer.render(scene, camera);
  }
  emitProgress(.5);
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { emitProgress(.6); });
})();
