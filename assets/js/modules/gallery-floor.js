// Painting page floor: perspective wood planks drawn in WebGL so they stay sharp while sliding.
const PLANK = 57;
export const FLOOR_PERIOD = PLANK * 64; // the plank pattern repeats every 64 planks

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uOrigin;
uniform float uFocal;
uniform float uSeam;
uniform vec3 uWall;
uniform float uPos;
uniform vec3 uWood;
uniform float uSheen;
out vec4 outColor;

const float PLANK = ${PLANK}.0;
const float BOARD = 260.0;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

// Box-filtered periodic line of width w (in cells) centred on whole numbers.
float lines(float u, float w, float fu) {
  fu = max(fu, 1e-4);
  float a = u - 0.5 * fu + 0.5 * w;
  float b = u + 0.5 * fu + 0.5 * w;
  float ia = floor(a) * w + min(fract(a), w);
  float ib = floor(b) * w + min(fract(b), w);
  return clamp((ib - ia) / fu, 0.0, 1.0);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  // Barrel bow: lift each column so the floor meets the wall's curved bottom edge.
  float t = clamp((p.x - uWall.x) / uWall.y * 2.0 - 1.0, -1.0, 1.0);
  float y = p.y + uWall.z * (1.0 - sqrt(max(1.0 - t * t, 0.0)));
  if (y < uSeam - 2.0) { outColor = vec4(0.0); return; }

  float z = uFocal * (uSeam - uOrigin.y) / max(y - uOrigin.y, 1e-3);
  float X = (p.x - uOrigin.x) * z / uFocal + uPos;
  float D = max(uFocal - z, 0.0);
  vec2 fw = fwidth(vec2(X, D));

  float u = X / PLANK;
  float pi = floor(u);
  float row = mod(pi, 64.0);
  float off = hash(vec2(row, 3.7)) * BOARD;
  float v = (D + off) / BOARD;
  float bj = floor(v);
  float id = hash(vec2(row, bj));
  float id2 = hash(vec2(bj + 5.3, row));

  vec3 col = uWood * mix(0.8, 1.16, id);
  col *= mix(vec3(1.0), vec3(1.05, 0.97, 0.88), id2);

  float gx = X - pi * PLANK;
  float gy = D + off + bj * 97.0;
  float n = fbm(vec2(gx * 0.05 + id * 31.0, gy * 0.01));
  float streak = 0.5 + 0.5 * sin(gx * 0.45 + n * 8.0 + id * 20.0);
  float gAtt = 1.0 - smoothstep(2.0, 6.0, fw.x);
  col *= mix(1.0, 0.8 + 0.2 * streak, 0.6 * gAtt);
  float fine = fbm(vec2(gx * 0.3, gy * 0.04) + id * 7.0);
  float fAtt = 1.0 - smoothstep(0.8, 2.5, fw.x);
  col *= mix(1.0, 0.88 + 0.24 * fine, 0.5 * fAtt);

  float seam = lines(u, 1.6 / PLANK, fw.x / PLANK);
  float bevel = lines(u - 1.9 / PLANK, 1.0 / PLANK, fw.x / PLANK);
  float joint = lines(v, 1.4 / BOARD, fw.y / BOARD);
  col *= 1.0 - 0.6 * seam;
  col *= 1.0 - 0.5 * joint;
  col += uWood * 0.12 * bevel;

  col *= mix(0.45, 1.0, smoothstep(0.0, 70.0, D));

  float sx = (p.x - uOrigin.x) / (uRes.x / uDpr);
  float sheen = exp(-sx * sx * 30.0) * exp(-D / 160.0);
  col += uSheen * sheen * vec3(1.0, 0.93, 0.82);

  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function colorOf(room, value) {
  const probe = document.createElement('i');
  probe.style.color = value;
  probe.style.display = 'none';
  room.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/[\d.]+/g) || [59, 42, 28];
  probe.remove();
  return rgb.slice(0, 3).map(function (c) { return Number(c) / 255; });
}

export function createFloor(room, wall) {
  const canvas = document.createElement('canvas');
  canvas.className = 'room-floor-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
  if (!gl || !wall) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attr = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

  const loc = {};
  ['uRes', 'uDpr', 'uOrigin', 'uFocal', 'uSeam', 'uWall', 'uPos', 'uWood', 'uSheen'].forEach(function (name) {
    loc[name] = gl.getUniformLocation(prog, name);
  });

  room.insertBefore(canvas, wall);
  room.classList.add('has-floor-gl');

  let pos = 0;
  let lit = 0;
  let litTarget = 0;
  let litRaf = 0;
  let geo = null;
  let wood = [0.23, 0.16, 0.11];
  let sheen = 0.12;
  let lost = false;

  function theme() {
    wood = colorOf(room, getComputedStyle(room).getPropertyValue('--gallery-floor').trim() || '#3b2a1c');
    sheen = document.documentElement.dataset.theme === 'light' ? 0.07 : 0.12;
  }

  function measure() {
    const W = room.clientWidth;
    const H = room.clientHeight;
    if (!W || !H) { geo = null; return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const cs = getComputedStyle(room);
    const origin = cs.perspectiveOrigin.split(' ').map(parseFloat);
    const radius = getComputedStyle(wall).borderBottomLeftRadius.trim().split(/\s+/);
    const ry = radius[radius.length - 1];
    const bow = ry.endsWith('%') ? parseFloat(ry) / 100 * wall.offsetHeight : parseFloat(ry) || 0;
    geo = {
      dpr: canvas.width / W,
      ox: origin[0] || W / 2,
      oy: origin[1] || H * 0.4,
      focal: parseFloat(cs.perspective) || 900,
      seam: wall.offsetTop + wall.offsetHeight,
      wl: wall.offsetLeft,
      ww: wall.offsetWidth,
      bow: bow,
    };
  }

  function draw() {
    if (lost || !geo) return;
    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform1f(loc.uDpr, geo.dpr);
    gl.uniform2f(loc.uOrigin, geo.ox, geo.oy);
    gl.uniform1f(loc.uFocal, geo.focal);
    gl.uniform1f(loc.uSeam, geo.seam);
    gl.uniform3f(loc.uWall, geo.wl, geo.ww, geo.bow);
    gl.uniform1f(loc.uPos, pos);
    gl.uniform3f(loc.uWood, wood[0], wood[1], wood[2]);
    gl.uniform1f(loc.uSheen, sheen * lit);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function fadeLight(t0) {
    let last = t0;
    litRaf = requestAnimationFrame(function step(t) {
      const dt = (t - last) / 1000;
      last = t;
      const dir = Math.sign(litTarget - lit);
      lit = Math.min(1, Math.max(0, lit + dir * dt / 0.4));
      draw();
      if ((dir > 0 && lit < litTarget) || (dir < 0 && lit > litTarget)) litRaf = requestAnimationFrame(step);
      else litRaf = 0;
    });
  }

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    lost = true;
    room.classList.remove('has-floor-gl');
  });

  new ResizeObserver(function () { measure(); draw(); }).observe(room);
  new MutationObserver(function () { theme(); draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  theme();
  measure();

  return {
    setPosition: function (p) { pos = p; draw(); },
    setLit: function (on) {
      litTarget = on ? 1 : 0;
      if (!litRaf && lit !== litTarget) fadeLight(performance.now());
    },
    resize: function () { measure(); draw(); },
  };
}
