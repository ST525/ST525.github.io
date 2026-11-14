// WebGL page peel for the picture book: the turning page is a mesh bent over
// a tilted cylinder that sweeps in from the bottom outer corner, so the
// corner lifts first and the fold runs diagonally, like a real page.
// Only the moving page is drawn here; the rest of the book stays in the DOM.
const PERSPECTIVE = 4200;
const COLS = 64;
const ROWS = 40;
const MAX_DPR = 2;
const MARGIN_X = 0.35;
const MARGIN_Y = 0.3;
const MAX_TEXTURES = 12;

const VERT = `
attribute vec2 aGrid;
uniform float uW, uH, uS, uSpine, uD, uA, uR, uPhi, uShadow, uTop;
uniform vec2 uOrigin, uSize, uCenter;
varying vec2 vUv;
varying vec3 vInfo;
const float PI = 3.14159265;

vec3 deformFromBottom(vec2 q) {
  vec2 n = vec2(cos(uA), sin(uA));
  float u = dot(q - vec2(uW, uH), n) + uD;
  if (u <= 0.0) return vec3(q, 0.0);
  vec2 foot = q - n * u;
  if (uR > 0.5 && u < PI * uR) {
    float th = u / uR;
    return vec3(foot + n * (uR * sin(th)), uR * (1.0 - cos(th)));
  }
  float L = u - PI * max(uR, 0.0);
  return vec3(foot - n * (L * cos(uPhi)), 2.0 * uR + L * sin(uPhi));
}

// uTop = 1 mirrors the page so the fold starts from the top corner.
vec3 deform(vec2 q0) {
  vec2 q = vec2(q0.x, mix(q0.y, uH - q0.y, uTop));
  vec3 r = deformFromBottom(q);
  return vec3(r.x, mix(r.y, uH - r.y, uTop), r.z);
}

vec3 world(vec2 q) {
  vec3 p = deform(q);
  return vec3(uSpine + uS * p.x, p.y, p.z);
}

void main() {
  vec2 q = aGrid * vec2(uW, uH);
  vec3 p = world(q);
  vec3 px = world(q + vec2(1.0, 0.0));
  vec3 py = world(q + vec2(0.0, 1.0));
  vec3 nrm = normalize(cross(px - p, py - p));
  vec3 light = normalize(vec3(-0.35, -0.55, 1.0));
  vInfo = vec3(0.7 + 0.3 * abs(dot(nrm, light)), p.z, uShadow + 2.0 * uS);
  vUv = aGrid;
  vec3 pp = p;
  if (uShadow > 0.5) pp = vec3(p.x + 0.1 * p.z * uS, p.y + 0.08 * p.z, 0.0);
  float k = PERSPECTIVE_K / (PERSPECTIVE_K - pp.z);
  vec2 s = uCenter + (pp.xy - uCenter) * k;
  vec2 c = (s - uOrigin) / uSize * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, -pp.z / 4000.0, 1.0);
}
`.replace(/PERSPECTIVE_K/g, PERSPECTIVE.toFixed(1));

const FRAG = `
precision mediump float;
uniform sampler2D uNear, uFar;
varying vec2 vUv;
varying vec3 vInfo;

void main() {
  float shade = vInfo.x;
  float z = vInfo.y;
  // vInfo.z = shadow + 2 * direction: 3 / 2 forward, -1 / -2 backward.
  bool shadow = vInfo.z > 2.5 || (vInfo.z > -1.5 && vInfo.z < -0.5);
  bool forward = vInfo.z > 0.0;
  if (shadow) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.22 * clamp(z / 40.0, 0.0, 1.0));
    return;
  }
  bool near = gl_FrontFacing == forward;
  float ux = forward ? vUv.x : 1.0 - vUv.x;
  vec4 col = near ? texture2D(uNear, vec2(ux, vUv.y)) : texture2D(uFar, vec2(1.0 - ux, vUv.y));
  gl_FragColor = vec4(col.rgb * shade, 1.0);
}
`;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function createPeel(volume) {
  const canvas = document.createElement('canvas');
  canvas.className = 'book-peel';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
    canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  const api = {
    available: false, canvas: null, start: start, drag: drag, setProgress: setProgress,
    release: release, cancel: cancel, cancelAll: cancelAll, resize: resize
  };
  const peels = [];
  const textures = new Map();
  let frame = 0;
  let layout = { width: 0, height: 0, pageWidth: 0, spine: 0, originX: 0, originY: 0, cssW: 0, cssH: 0 };
  if (!gl) return api;

  function shader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    if (window.console) console.warn('Book peel disabled:', err.message);
    return api;
  }
  api.available = true;
  api.hurry = hurry;
  // Turn a leaf's peel round from where it is, landing within ms: a peel
  // heading for 1 falls back to 0 (onCancel) and vice versa.
  api.reverse = function (leaf, ms) {
    const now = performance.now();
    peels.forEach(function (peel) {
      if (peel.leaf !== leaf) return;
      let t = peel.progress;
      if (!peel.manual) {
        const k = Math.min(1, (now - peel.begin) / peel.duration);
        t = peel.from + (peel.to - peel.from) * k;
      }
      peel.manual = false;
      peel.from = t;
      peel.to = peel.to === 0 ? 1 : 0;
      peel.begin = now;
      peel.duration = ms;
    });
  };
  // Where a leaf's peel is now, 0 (flat on its start side) to 1 (landed).
  api.progress = function (leaf) {
    const now = performance.now();
    for (let i = 0; i < peels.length; i++) {
      const peel = peels[i];
      if (peel.leaf !== leaf) continue;
      if (peel.manual) return peel.progress;
      const k = Math.min(1, (now - peel.begin) / peel.duration);
      return peel.from + (peel.to - peel.from) * k;
    }
    return -1;
  };
  api.canvas = canvas;
  volume.appendChild(canvas);

  const uniforms = {};
  ['uW', 'uH', 'uS', 'uSpine', 'uD', 'uA', 'uR', 'uPhi', 'uShadow', 'uTop', 'uOrigin', 'uSize', 'uCenter', 'uNear', 'uFar']
    .forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
  const aGrid = gl.getAttribLocation(program, 'aGrid');

  const grid = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const i = (r * (COLS + 1) + c) * 2;
      grid[i] = c / COLS;
      grid[i + 1] = r / ROWS;
    }
  }
  const index = new Uint16Array(COLS * ROWS * 6);
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      const b = a + COLS + 1;
      index[n++] = a; index[n++] = b; index[n++] = a + 1;
      index[n++] = a + 1; index[n++] = b; index[n++] = b + 1;
    }
  }
  const gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

  // Blank page colour for pages without an image (single-page mode backs).
  const blank = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([245, 237, 218, 255]));

  function textureFor(img) {
    if (!img || !img.complete || !img.naturalWidth) return null;
    let tex = textures.get(img);
    if (tex) {
      textures.delete(img);
      textures.set(img, tex);
      return tex;
    }
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (err) {
      gl.deleteTexture(tex);
      return null;
    }
    textures.set(img, tex);
    if (textures.size > MAX_TEXTURES) {
      const oldest = textures.keys().next().value;
      gl.deleteTexture(textures.get(oldest));
      textures.delete(oldest);
    }
    return tex;
  }

  function resize(pageWidth, pageHeight, spread) {
    if (!api.available) return;
    const width = spread ? pageWidth * 2 : pageWidth;
    const mx = Math.round(pageWidth * MARGIN_X);
    const my = Math.round(pageHeight * MARGIN_Y);
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    layout = {
      width: width,
      height: pageHeight,
      pageWidth: pageWidth,
      spine: spread ? pageWidth : 0,
      originX: -mx,
      originY: -my,
      cssW: width + 2 * mx,
      cssH: pageHeight + 2 * my
    };
    canvas.style.left = -mx + 'px';
    canvas.style.top = -my + 'px';
    canvas.style.width = layout.cssW + 'px';
    canvas.style.height = layout.cssH + 'px';
    canvas.width = Math.round(layout.cssW * dpr);
    canvas.height = Math.round(layout.cssH * dpr);
  }

  // leaf: the DOM leaf being turned (used as a key). forward: the page
  // starts on the right. nearImg/farImg: the page facing the reader now
  // and the one showing once it has turned.
  function start(opts) {
    cancel(opts.leaf);
    peels.push({
      leaf: opts.leaf,
      forward: opts.forward,
      // 'bottom' | 'top' corner lifts first; 'none' folds straight across.
      corner: opts.corner || 'bottom',
      nearImg: opts.nearImg,
      farImg: opts.farImg,
      duration: opts.duration,
      begin: performance.now(),
      from: 0,
      to: 1,
      manual: false,
      progress: 0,
      onDone: opts.onDone,
      onCancel: opts.onCancel || null
    });
    canvas.classList.add('is-on');
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // A peel driven by the pointer: progress is set directly until release()
  // lets it finish (to 1) or fall back (to 0).
  function drag(opts) {
    start(opts);
    const peel = peels[peels.length - 1];
    peel.manual = true;
    peel.duration = 0;
  }

  function setProgress(leaf, value) {
    peels.forEach(function (peel) {
      if (peel.leaf === leaf && peel.manual) peel.progress = Math.max(0, Math.min(1, value));
    });
  }

  function release(leaf, commit) {
    peels.forEach(function (peel) {
      if (peel.leaf !== leaf || !peel.manual) return;
      peel.manual = false;
      peel.from = peel.progress;
      peel.to = commit ? 1 : 0;
      peel.begin = performance.now();
      peel.duration = 90 + 420 * Math.max(0.25, Math.abs(peel.to - peel.from));
    });
  }

  // Another turn has started on top of these: land them within ms so no
  // more than a moment of two pages overlap in the air.
  function hurry(ms) {
    const now = performance.now();
    peels.forEach(function (peel) {
      if (peel.manual) return;
      const left = peel.duration - (now - peel.begin);
      if (left <= ms) return;
      peel.from = peel.progress;
      peel.begin = now;
      peel.duration = ms;
    });
  }

  function cancel(leaf) {
    for (let i = peels.length - 1; i >= 0; i--) {
      if (peels[i].leaf === leaf) peels.splice(i, 1);
    }
    if (!peels.length) stop();
  }

  function cancelAll() {
    peels.length = 0;
    stop();
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.classList.remove('is-on');
    if (gl) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  function drawPeel(peel, t) {
    const e = easeInOut(t);
    const W = layout.pageWidth;
    const H = layout.height;
    // Fold tilt (0 = parallel to the spine), bend radius and how far the
    // turned part lifts off the page. All return to 0 so the page lands flat.
    const alpha = peel.corner === 'none' ? 0 : 0.55 * Math.pow(1 - e, 1.2);
    const radius = 2 + 0.18 * Math.min(W, H) * Math.pow(Math.sin(Math.PI * e), 0.6);
    const phi = 0.8 * Math.sin(Math.PI * e);
    // The fold starts at the bottom outer corner and ends on the spine. Near
    // the corner little of the page is past the fold, so it moves faster
    // there and slows as the whole page is in the air.
    const reach = W + H * Math.sin(alpha) * (1 - e);
    const d = reach * Math.pow(e, 0.65);
    gl.uniform1f(uniforms.uW, W);
    gl.uniform1f(uniforms.uH, H);
    gl.uniform1f(uniforms.uS, peel.forward ? 1 : -1);
    gl.uniform1f(uniforms.uSpine, layout.spine);
    gl.uniform1f(uniforms.uD, d);
    gl.uniform1f(uniforms.uA, alpha);
    gl.uniform1f(uniforms.uR, radius);
    gl.uniform1f(uniforms.uPhi, phi);
    gl.uniform1f(uniforms.uTop, peel.corner === 'top' ? 1 : 0);
    gl.uniform2f(uniforms.uOrigin, layout.originX, layout.originY);
    gl.uniform2f(uniforms.uSize, layout.cssW, layout.cssH);
    gl.uniform2f(uniforms.uCenter, layout.width / 2, H / 2);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureFor(peel.nearImg) || blank);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textureFor(peel.farImg) || blank);

    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(uniforms.uShadow, 1);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniforms.uShadow, 0);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
  }

  function tick(now) {
    frame = 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.enableVertexAttribArray(aGrid);
    gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.uniform1i(uniforms.uNear, 0);
    gl.uniform1i(uniforms.uFar, 1);

    // The page that lifted first was on top of its stack, so it draws last
    // and covers the ones following it, in either direction.
    const order = peels.slice().sort(function (a, b) {
      return b.begin - a.begin;
    });
    const done = [];
    order.forEach(function (peel) {
      let t = peel.progress;
      if (!peel.manual) {
        const k = Math.min(1, (now - peel.begin) / peel.duration);
        t = peel.from + (peel.to - peel.from) * k;
        peel.progress = t;
        if (k >= 1) done.push(peel);
      }
      drawPeel(peel, t);
    });
    done.forEach(function (peel) {
      const i = peels.indexOf(peel);
      if (i >= 0) peels.splice(i, 1);
    });
    if (peels.length) {
      frame = requestAnimationFrame(tick);
    } else {
      stop();
    }
    done.forEach(function (peel) {
      if (peel.to === 0 && peel.onCancel) peel.onCancel();
      else peel.onDone();
    });
  }

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    api.available = false;
    const pending = peels.slice();
    cancelAll();
    pending.forEach(function (peel) { peel.onDone(); });
  });

  return api;
}
