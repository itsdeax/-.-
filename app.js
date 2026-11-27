(() => {
  const OUT_ASPECT = 3 / 4;
  const PREVIEW_WIDTH = 720;
  const CAPTURE_WIDTH = 1440;
  const SETTINGS_KEY = "thaisuay.settings.v1";

  const FILTER_DEFAULTS = {
    exposure: 0,
    contrast: 1,
    sat: 1,
    temp: 0,
    tint: 0,
    fade: 0,
    vig: 0,
    grain: 0,
    mono: 0,
  };

  const FILTERS = [
    {
      id: "natural",
      name: "ธรรมชาติ",
      chip: "linear-gradient(135deg,#f3e3d6,#d9b9a4)",
      p: {},
    },
    {
      id: "cream",
      name: "ครีมนุ่ม",
      chip: "linear-gradient(135deg,#fff1dc,#f0cfae)",
      p: { exposure: 0.14, contrast: 0.92, sat: 0.9, temp: 0.25, tint: 0.08, fade: 0.06 },
    },
    {
      id: "peach",
      name: "พีช",
      chip: "linear-gradient(135deg,#ffd9c2,#ff9d8a)",
      p: { exposure: 0.1, contrast: 0.96, sat: 1.06, temp: 0.35, tint: 0.28, fade: 0.05, vig: 0.15 },
    },
    {
      id: "rose",
      name: "โรส",
      chip: "linear-gradient(135deg,#ffd0dc,#e8688c)",
      p: { exposure: 0.08, contrast: 1.0, sat: 1.12, temp: 0.08, tint: 0.5, fade: 0.04 },
    },
    {
      id: "clear",
      name: "ใสปิ๊ง",
      chip: "linear-gradient(135deg,#e3f3ff,#9ed0f5)",
      p: { exposure: 0.22, contrast: 1.05, sat: 1.16, temp: -0.15 },
    },
    {
      id: "film",
      name: "ฟิล์ม",
      chip: "linear-gradient(135deg,#c9b79a,#6f5a46)",
      p: { contrast: 1.12, sat: 0.84, temp: 0.2, tint: -0.1, fade: 0.1, vig: 0.38, grain: 0.06 },
    },
    {
      id: "golden",
      name: "โกลเด้น",
      chip: "linear-gradient(135deg,#ffe29a,#f0a43c)",
      p: { exposure: 0.1, contrast: 1.05, sat: 1.12, temp: 0.65, tint: 0.1, fade: 0.03, vig: 0.25 },
    },
    {
      id: "cool",
      name: "ฟ้าเย็น",
      chip: "linear-gradient(135deg,#cfe3ff,#6c8fd1)",
      p: { exposure: 0.05, contrast: 1.06, sat: 0.95, temp: -0.55, tint: -0.1, fade: 0.04 },
    },
    {
      id: "mono",
      name: "ขาวดำ",
      chip: "linear-gradient(135deg,#e8e8e8,#3a3a3a)",
      p: { contrast: 1.2, mono: 1, fade: 0.04, vig: 0.3, grain: 0.05 },
    },
  ];

  const DEFAULT_SETTINGS = {
    filter: "cream",
    smooth: 0.45,
    glow: 0.3,
    intensity: 0.85,
    timer: 0,
    fill: false,
    facing: "user",
  };

  const TIMER_STEPS = [0, 3, 5, 10];

  const $ = (id) => document.getElementById(id);
  const screenCamera = $("screen-camera");
  const screenResult = $("screen-result");
  const canvas = $("view");
  const video = $("source-video");
  const stage = $("stage");
  const hint = $("stage-hint");
  const badge = $("compare-badge");
  const exitEditBtn = $("btn-exit-edit");
  const countdownEl = $("countdown");
  const flashEl = $("shutter-flash");
  const shutterBtn = $("btn-shutter");
  const tunePanel = $("tune-panel");
  const tuneBtn = $("btn-tune");
  const filterStrip = $("filter-strip");
  const fileInput = $("file-input");
  const resultImg = $("result-img");
  const saveBtn = $("btn-save");
  const shareBtn = $("btn-share");
  const toastEl = $("toast");
  const timerBtn = $("btn-timer");
  const timerLabel = $("timer-label");
  const lightBtn = $("btn-light");

  const sliders = {
    smooth: { input: $("range-smooth"), out: $("out-smooth") },
    glow: { input: $("range-glow"), out: $("out-glow") },
    intensity: { input: $("range-intensity"), out: $("out-intensity") },
  };

  let settings = loadSettings();
  let stream = null;
  let mode = "camera";
  let imageSource = null;
  let comparing = false;
  let counting = null;
  let dirty = true;
  let activeScreen = "camera";
  let resultBlob = null;
  let resultUrl = null;
  let toastTimer = null;
  let cameraToken = 0;

  const renderer = createRenderer(canvas);

  /* ---------- settings ---------- */

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable */
    }
  }

  /* ---------- WebGL renderer ---------- */

  function createRenderer(target) {
    const gl =
      target.getContext("webgl", { preserveDrawingBuffer: true, antialias: false }) ||
      target.getContext("experimental-webgl", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) return null;

    const vertexSrc = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    const fragmentSrc = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 v_uv;
      uniform sampler2D u_tex;
      uniform vec2 u_texel;
      uniform vec2 u_crop;
      uniform float u_mirror;
      uniform float u_radius;
      uniform float u_smooth;
      uniform float u_glow;
      uniform float u_intensity;
      uniform float u_exposure;
      uniform float u_contrast;
      uniform float u_sat;
      uniform float u_temp;
      uniform float u_tint;
      uniform float u_fade;
      uniform float u_vig;
      uniform float u_grain;
      uniform float u_mono;
      uniform float u_seed;

      float luma(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
      }

      float skinMask(vec3 c) {
        float cb = -0.169 * c.r - 0.331 * c.g + 0.5 * c.b + 0.5;
        float cr = 0.5 * c.r - 0.419 * c.g - 0.081 * c.b + 0.5;
        float mb = smoothstep(0.28, 0.31, cb) * (1.0 - smoothstep(0.50, 0.53, cb));
        float mr = smoothstep(0.50, 0.52, cr) * (1.0 - smoothstep(0.68, 0.72, cr));
        float ml = smoothstep(0.12, 0.25, luma(c));
        return mb * mr * ml;
      }

      vec3 smoothSkin(vec2 uv, vec3 center) {
        vec3 sum = center;
        float wsum = 1.0;
        for (int i = 0; i < 16; i++) {
          float fi = float(i);
          float a = fi * 2.39996;
          float r = sqrt((fi + 1.0) / 16.0);
          vec2 off = vec2(cos(a), sin(a)) * r * u_radius * u_texel;
          vec3 s = texture2D(u_tex, uv + off).rgb;
          vec3 d = s - center;
          float w = exp(-dot(d, d) / 0.02) * (1.0 - 0.4 * r);
          sum += s * w;
          wsum += w;
        }
        return sum / wsum;
      }

      void main() {
        vec2 uv = (v_uv - 0.5) * u_crop + 0.5;
        if (u_mirror > 0.5) uv.x = 1.0 - uv.x;

        vec3 orig = texture2D(u_tex, uv).rgb;
        vec3 c = orig;
        float mask = skinMask(orig);

        if (u_smooth > 0.001) {
          vec3 sm = smoothSkin(uv, orig);
          c = mix(orig, sm, clamp(mask * u_smooth * 1.4, 0.0, 1.0));
        }
        c += mask * u_glow * 0.1 * (1.0 - c);

        vec3 g = c * exp2(u_exposure);
        g.r += u_temp * 0.08;
        g.b -= u_temp * 0.08;
        g.g -= u_tint * 0.04;
        g.r += u_tint * 0.025;
        g.b += u_tint * 0.025;
        g = (g - 0.5) * u_contrast + 0.5;
        float l = luma(g);
        g = mix(vec3(l), g, u_sat);
        g = mix(g, vec3(luma(g)), u_mono);
        g = u_fade + g * (1.0 - u_fade);

        vec2 q = (v_uv - 0.5) * vec2(1.0, 1.15);
        g *= 1.0 - u_vig * smoothstep(0.3, 0.85, length(q));

        float n = fract(sin(dot(v_uv * 997.0 + u_seed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        g += n * u_grain;

        c = mix(c, g, u_intensity);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`;

    function compile(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uniforms = {};
    [
      "u_tex", "u_texel", "u_crop", "u_mirror", "u_radius", "u_smooth", "u_glow",
      "u_intensity", "u_exposure", "u_contrast", "u_sat", "u_temp", "u_tint",
      "u_fade", "u_vig", "u_grain", "u_mono", "u_seed",
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });
    gl.uniform1i(uniforms.u_tex, 0);

    return {
      setSize(w, h) {
        if (target.width !== w || target.height !== h) {
          target.width = w;
          target.height = h;
        }
        gl.viewport(0, 0, w, h);
      },
      upload(source) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      },
      draw(p) {
        gl.uniform2f(uniforms.u_texel, p.texel[0], p.texel[1]);
        gl.uniform2f(uniforms.u_crop, p.crop[0], p.crop[1]);
        gl.uniform1f(uniforms.u_mirror, p.mirror ? 1 : 0);
        gl.uniform1f(uniforms.u_radius, p.radius);
        gl.uniform1f(uniforms.u_smooth, p.smooth);
        gl.uniform1f(uniforms.u_glow, p.glow);
        gl.uniform1f(uniforms.u_intensity, p.intensity);
        gl.uniform1f(uniforms.u_exposure, p.f.exposure);
        gl.uniform1f(uniforms.u_contrast, p.f.contrast);
        gl.uniform1f(uniforms.u_sat, p.f.sat);
        gl.uniform1f(uniforms.u_temp, p.f.temp);
        gl.uniform1f(uniforms.u_tint, p.f.tint);
        gl.uniform1f(uniforms.u_fade, p.f.fade);
        gl.uniform1f(uniforms.u_vig, p.f.vig);
        gl.uniform1f(uniforms.u_grain, p.f.grain);
        gl.uniform1f(uniforms.u_mono, p.f.mono);
        gl.uniform1f(uniforms.u_seed, p.seed);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }

  /* ---------- source helpers ---------- */

  function sourceSize() {
    if (mode === "image" && imageSource) {
      return { w: imageSource.width, h: imageSource.height };
    }
    return { w: video.videoWidth, h: video.videoHeight };
  }

  function cropGeometry(size) {
    const sa = size.w / size.h;
    if (sa > OUT_ASPECT) {
      return { crop: [OUT_ASPECT / sa, 1], regionW: size.h * OUT_ASPECT };
    }
    return { crop: [1, sa / OUT_ASPECT], regionW: size.w };
  }

  function outputDims(targetWidth, size) {
    const { regionW } = cropGeometry(size);
    let w = Math.min(targetWidth, Math.floor(regionW));
    w -= w % 2;
    const h = Math.round(w / OUT_ASPECT / 2) * 2;
    return { w, h };
  }

  function currentFilter() {
    const found = FILTERS.find((f) => f.id === settings.filter) || FILTERS[0];
    return { ...FILTER_DEFAULTS, ...found.p };
  }

  function drawParams(size, original) {
    const geo = cropGeometry(size);
    return {
      texel: [1 / size.w, 1 / size.h],
      crop: geo.crop,
      mirror: mode === "camera" && settings.facing === "user",
      radius: 11 * (geo.regionW / 1080),
      smooth: original ? 0 : settings.smooth,
      glow: original ? 0 : settings.glow,
      intensity: original ? 0 : settings.intensity,
      f: currentFilter(),
      seed: (performance.now() % 1000) / 1000,
    };
  }

  function sourceReady() {
    if (mode === "image") return Boolean(imageSource);
    return video.readyState >= 2 && video.videoWidth > 0;
  }

  /* ---------- render loop ---------- */

  function frame() {
    requestAnimationFrame(frame);
    if (!renderer || activeScreen !== "camera" || !sourceReady()) return;

    const isVideo = mode === "camera";
    if (!isVideo && !dirty) return;

    const size = sourceSize();
    const dims = outputDims(PREVIEW_WIDTH, size);
    renderer.setSize(dims.w, dims.h);
    renderer.upload(isVideo ? video : imageSource);
    renderer.draw(drawParams(size, comparing));
    dirty = false;
  }

  /* ---------- UI helpers ---------- */

  function showScreen(name) {
    activeScreen = name;
    screenCamera.hidden = name !== "camera";
    screenResult.hidden = name !== "result";
    screenCamera.classList.toggle("is-active", name === "camera");
    screenResult.classList.toggle("is-active", name === "result");
  }

  function setHint(text) {
    hint.textContent = text || "";
    hint.classList.toggle("is-hidden", !text);
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function renderFilterStrip() {
    filterStrip.innerHTML = "";
    FILTERS.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(f.id === settings.filter));
      btn.dataset.id = f.id;

      const swatch = document.createElement("span");
      swatch.className = "filter-swatch";
      swatch.style.background = f.chip;
      const name = document.createElement("span");
      name.textContent = f.name;

      btn.append(swatch, name);
      btn.addEventListener("click", () => selectFilter(f.id));
      filterStrip.appendChild(btn);
    });
  }

  function selectFilter(id) {
    settings.filter = id;
    saveSettings();
    dirty = true;
    filterStrip.querySelectorAll(".filter-chip").forEach((el) => {
      const on = el.dataset.id === id;
      el.setAttribute("aria-selected", String(on));
      if (on) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  function syncSliders() {
    Object.entries(sliders).forEach(([key, { input, out }]) => {
      const value = Math.round(settings[key] * 100);
      input.value = String(value);
      out.textContent = String(value);
    });
  }

  function syncToolbar() {
    timerLabel.textContent = settings.timer ? `${settings.timer} วิ` : "ปิด";
    timerBtn.classList.toggle("is-on", settings.timer > 0);
    lightBtn.setAttribute("aria-pressed", String(settings.fill));
    lightBtn.hidden = settings.facing !== "user" || mode !== "camera";
    screenCamera.classList.toggle("screen-fill", settings.fill && !lightBtn.hidden);
  }

  /* ---------- camera ---------- */

  function stopCamera() {
    cameraToken += 1;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  async function startCamera() {
    stopCamera();
    const token = cameraToken;
    mode = "camera";
    imageSource = null;
    exitEditBtn.hidden = true;
    shutterBtn.disabled = true;
    syncToolbar();
    setHint("กำลังเปิดกล้อง…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("เปิดกล้องไม่ได้บนเครื่องนี้ กดแต่งรูปเพื่อเลือกรูป");
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: settings.facing },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      if (token !== cameraToken) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = media;
      video.srcObject = media;
      await video.play();
      shutterBtn.disabled = false;
      setHint("");
    } catch (err) {
      console.warn(err);
      setHint("ยังเปิดกล้องไม่ได้ อนุญาตสิทธิ์กล้อง หรือกดแต่งรูป");
    }
  }

  /* ---------- capture ---------- */

  function renderToBlob() {
    const size = sourceSize();
    const dims = outputDims(CAPTURE_WIDTH, size);
    const previewDims = outputDims(PREVIEW_WIDTH, size);

    renderer.setSize(dims.w, dims.h);
    renderer.upload(mode === "camera" ? video : imageSource);
    renderer.draw(drawParams(size, false));

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
      renderer.setSize(previewDims.w, previewDims.h);
      dirty = true;
    });
  }

  async function takePhoto() {
    if (!renderer || !sourceReady()) return;
    flashEl.classList.remove("is-on");
    void flashEl.offsetWidth;
    flashEl.classList.add("is-on");

    const blob = await renderToBlob();
    if (!blob) {
      toast("บันทึกภาพไม่สำเร็จ ลองอีกครั้ง");
      return;
    }
    showResult(blob);
  }

  function runCountdown(seconds) {
    return new Promise((resolve) => {
      let left = seconds;
      shutterBtn.classList.add("is-counting");
      countdownEl.hidden = false;

      const tick = () => {
        if (counting === null) return resolve(false);
        if (left === 0) {
          counting = null;
          countdownEl.hidden = true;
          shutterBtn.classList.remove("is-counting");
          return resolve(true);
        }
        countdownEl.innerHTML = "";
        const span = document.createElement("span");
        span.textContent = String(left);
        countdownEl.appendChild(span);
        left -= 1;
        counting = setTimeout(tick, 1000);
      };
      counting = 0;
      tick();
    });
  }

  function cancelCountdown() {
    if (counting === null) return;
    clearTimeout(counting);
    counting = null;
    countdownEl.hidden = true;
    shutterBtn.classList.remove("is-counting");
  }

  async function onShutter() {
    if (counting !== null) {
      cancelCountdown();
      return;
    }
    if (settings.timer > 0 && mode === "camera") {
      const ok = await runCountdown(settings.timer);
      if (!ok) return;
    }
    takePhoto();
  }

  /* ---------- result ---------- */

  function showResult(blob) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultBlob = blob;
    resultUrl = URL.createObjectURL(blob);
    resultImg.src = resultUrl;
    const canShare =
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([blob], "photo.jpg", { type: "image/jpeg" })] });
    shareBtn.hidden = !canShare;
    showScreen("result");
  }

  function fileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `thaisuay-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
  }

  function savePhoto() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("บันทึกรูปแล้ว");
  }

  async function sharePhoto() {
    if (!resultBlob) return;
    const file = new File([resultBlob], fileName(), { type: "image/jpeg" });
    try {
      await navigator.share({ files: [file], title: "ถ่ายสวย" });
    } catch (err) {
      if (err?.name !== "AbortError") toast("แชร์ไม่สำเร็จ");
    }
  }

  async function backToCamera() {
    showScreen("camera");
    if (mode === "camera") await startCamera();
    else dirty = true;
  }

  /* ---------- import photo ---------- */

  async function loadImage(file) {
    const maxSide = 2560;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
    return c;
  }

  async function onImport() {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    try {
      imageSource = await loadImage(file);
    } catch {
      toast("เปิดรูปนี้ไม่ได้");
      return;
    }
    cancelCountdown();
    stopCamera();
    mode = "image";
    dirty = true;
    shutterBtn.disabled = false;
    exitEditBtn.hidden = false;
    setHint("");
    syncToolbar();
  }

  /* ---------- events ---------- */

  shutterBtn.addEventListener("click", onShutter);

  $("btn-flip").addEventListener("click", async () => {
    if (mode !== "camera") return;
    settings.facing = settings.facing === "user" ? "environment" : "user";
    saveSettings();
    await startCamera();
  });

  timerBtn.addEventListener("click", () => {
    const i = TIMER_STEPS.indexOf(settings.timer);
    settings.timer = TIMER_STEPS[(i + 1) % TIMER_STEPS.length];
    saveSettings();
    syncToolbar();
  });

  lightBtn.addEventListener("click", () => {
    settings.fill = !settings.fill;
    saveSettings();
    syncToolbar();
  });

  tuneBtn.addEventListener("click", () => {
    const open = !tunePanel.classList.contains("is-open");
    tunePanel.classList.toggle("is-open", open);
    tuneBtn.setAttribute("aria-expanded", String(open));
  });

  Object.entries(sliders).forEach(([key, { input, out }]) => {
    input.addEventListener("input", () => {
      settings[key] = Number(input.value) / 100;
      out.textContent = input.value;
      dirty = true;
    });
    input.addEventListener("change", saveSettings);
  });

  $("btn-reset").addEventListener("click", () => {
    settings.smooth = DEFAULT_SETTINGS.smooth;
    settings.glow = DEFAULT_SETTINGS.glow;
    settings.intensity = DEFAULT_SETTINGS.intensity;
    saveSettings();
    syncSliders();
    dirty = true;
  });

  $("btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", onImport);
  exitEditBtn.addEventListener("click", backToCamera);

  const startCompare = (e) => {
    if (e.target === exitEditBtn) return;
    comparing = true;
    badge.hidden = false;
    dirty = true;
  };
  const endCompare = () => {
    if (!comparing) return;
    comparing = false;
    badge.hidden = true;
    dirty = true;
  };
  stage.addEventListener("pointerdown", startCompare);
  window.addEventListener("pointerup", endCompare);
  window.addEventListener("pointercancel", endCompare);
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  $("btn-retake").addEventListener("click", backToCamera);
  saveBtn.addEventListener("click", savePhoto);
  shareBtn.addEventListener("click", sharePhoto);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelCountdown();
      if (mode === "camera") stopCamera();
    } else if (mode === "camera" && activeScreen === "camera") {
      startCamera();
    }
  });

  /* ---------- boot ---------- */

  renderFilterStrip();
  syncSliders();
  syncToolbar();

  if (!renderer) {
    setHint("เครื่องนี้ไม่รองรับฟิลเตอร์ (WebGL)");
    shutterBtn.disabled = true;
  } else {
    requestAnimationFrame(frame);
    startCamera();
  }

  const selected = filterStrip.querySelector('[aria-selected="true"]');
  if (selected) selected.scrollIntoView({ inline: "center", block: "nearest" });
})();
