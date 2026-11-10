/* Fundo líquido verde granulado (WebGL), inspirado no vídeo de referência. Fica atrás de todo o conteúdo depois da viagem 3D. */
(function () {
  var cv = document.createElement('canvas'); cv.className = 'liquid'; cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) { cv.classList.add('static'); return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;uniform vec2 r;uniform float t;uniform float dim;',
    'vec3 h(vec2 p){vec3 q=vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9)));return fract(sin(q)*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' float a=h(i).x,b=h(i+vec2(1,0)).x,c=h(i+vec2(0,1)).x,d=h(i+vec2(1,1)).x;return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;float s=t*.045;',
    ' vec2 q=vec2(fbm(p+vec2(0.,s)),fbm(p+vec2(5.2,1.3)-s));',
    ' vec2 w=vec2(fbm(p+3.*q+vec2(1.7,9.2)+s*.8),fbm(p+3.*q+vec2(8.3,2.8)-s*.6));',
    ' float v=smoothstep(.2,.85,fbm(p+2.6*w));',
    ' vec3 c=mix(vec3(.01,.04,.015),vec3(.04,.29,.13),smoothstep(0.,.35,v));',
    ' c=mix(c,vec3(.08,.63,.29),smoothstep(.3,.62,v));c=mix(c,vec3(.76,.96,.23),smoothstep(.6,.86,v));c=mix(c,vec3(.94,.97,.88),smoothstep(.86,1.,v));',
    ' c*=dim;float g=h(gl_FragCoord.xy+fract(t)*91.).x-.5;c+=g*.07;',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.classList.add('static'); return; }
  gl.useProgram(pr);
  var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uD = gl.getUniformLocation(pr, 'dim');
  var scale = .5;
  function size() { cv.width = Math.max(1, Math.round(innerWidth * scale)); cv.height = Math.max(1, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); }
  addEventListener('resize', size); size();
  var t0 = performance.now(), jn = document.getElementById('journey');
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    var jb = jn ? jn.getBoundingClientRect().bottom : -1, op = Math.max(0, Math.min(1, (innerHeight * 1.1 - jb) / (innerHeight * .6)));
    cv.style.opacity = op; if (op <= 0) return;
    gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, reduce ? 20 : (now - t0) / 1000); gl.uniform1f(uD, .42);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(frame);
})();
