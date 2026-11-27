(() => {
  const OUT_ASPECT = 3 / 4;
  const PREVIEW_WIDTH = 720;
  const CAPTURE_WIDTH = 1440;
  const SETTINGS_KEY = "thaisuay.settings.v1";

  const PARAMS = [
    { key: "exposure", label: "แสง", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "contrast", label: "คอนทราสต์", min: 0.6, max: 1.6, step: 0.01, def: 1 },
    { key: "sat", label: "ความอิ่มสี", min: 0, max: 2, step: 0.01, def: 1 },
    { key: "temp", label: "อุ่น / เย็น", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "tint", label: "ชมพู / เขียว", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "fade", label: "ฟาง (ดำจาง)", min: 0, max: 0.3, step: 0.005, def: 0 },
    { key: "vig", label: "ขอบมืด", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "grain", label: "เกรน", min: 0, max: 0.2, step: 0.005, def: 0 },
    { key: "mono", label: "ขาวดำ", min: 0, max: 1, step: 0.01, def: 0 },
  ];

  const CUSTOM_KEY = "thaisuay.customFilters.v1";
  const DEV_MODE = new URLSearchParams(location.search).has("dev");
  const HEX = /^#[0-9a-f]{6}$/i;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function normalizeParams(p) {
    const out = {};
    PARAMS.forEach(({ key, min, max, def }) => {
      const v = Number(p?.[key]);
      out[key] = Number.isFinite(v) ? clamp(v, min, max) : def;
    });
    return out;
  }

  function normalizeFilter(f, custom) {
    const chip = Array.isArray(f?.chip) ? f.chip : [];
    return {
      id: String(f?.id ?? ""),
      name: String(f?.name ?? "").slice(0, 20) || "ฟิลเตอร์",
      chip: [HEX.test(chip[0]) ? chip[0] : "#e9d9cf", HEX.test(chip[1]) ? chip[1] : "#b89d8c"],
      p: normalizeParams(f?.p),
      custom,
      kind: f?.model ? "camera" : "filter",
      model: String(f?.model ?? "").slice(0, 16),
      fx: {
        bloom: clamp(Number(f?.fx?.bloom) || 0, 0, 1),
        leak: clamp(Number(f?.fx?.leak) || 0, 0, 1),
        aber: clamp(Number(f?.fx?.aber) || 0, 0, 1),
      },
      stamp: Boolean(f?.stamp),
      frame: f?.frame === "polaroid" ? "polaroid" : "",
    };
  }

  function loadCustomFilters() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      return Array.isArray(raw) ? raw.map((f) => normalizeFilter(f, true)).filter((f) => f.id) : [];
    } catch {
      return [];
    }
  }

  function saveCustomFilters() {
    const data = customFilters.map(({ id, name, chip, p }) => ({ id, name, chip, p }));
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable */
    }
  }

  const builtinFilters = [...(window.THAISUAY_FILTERS || []), ...(window.THAISUAY_CAMERAS || [])].map((f) =>
    normalizeFilter(f, false)
  );
  if (!builtinFilters.length) {
    builtinFilters.push(normalizeFilter({ id: "natural", name: "ธรรมชาติ", p: {} }, false));
  }
  let customFilters = loadCustomFilters();
  const allFilters = () => [...builtinFilters, ...customFilters];

  const DEFAULT_SETTINGS = {
    filter: "clean",
    smooth: 0.45,
    glow: 0.3,
    intensity: 1,
    timer: 0,
    fill: false,
    facing: "user",
    face: { slim: 0, jaw: 0, chin: 0, forehead: 0, eyes: 0, nose: 0, mouth: 0 },
    makeup: { lip: "", blush: "", shadow: "", amount: 0.55 },
    skin: { teeth: 0, dark: 0, highlight: 0, contour: 0 },
  };

  const FACE_SLIDERS = [
    { key: "slim", label: "หน้าเรียว", min: 0 },
    { key: "jaw", label: "กรามเล็ก", min: 0 },
    { key: "chin", label: "คาง สั้น ↔ ยาว", min: -100 },
    { key: "forehead", label: "หน้าผาก ต่ำ ↔ สูง", min: -100 },
    { key: "eyes", label: "ตาโต", min: 0 },
    { key: "nose", label: "จมูกเล็ก", min: 0 },
    { key: "mouth", label: "ปาก เล็ก ↔ ใหญ่", min: -100 },
  ];

  const SKIN_SLIDERS = [
    { key: "teeth", label: "ฟันขาว" },
    { key: "dark", label: "ลดใต้ตาคล้ำ" },
    { key: "highlight", label: "ไฮไลท์ สันจมูก/โหนก" },
    { key: "contour", label: "เฉดโหนกแก้ม" },
  ];

  const MAKEUP_ROWS = [
    {
      key: "lip",
      label: "ลิป",
      colors: ["#d7848a", "#e0567c", "#ee6c5a", "#c8283a", "#9c2f5a", "#a5594e"],
    },
    { key: "blush", label: "บลัช", colors: ["#ff9a85", "#ff7fa6", "#e86a86", "#ffa86a"] },
    { key: "shadow", label: "อายแชโดว์", colors: ["#d9948f", "#8a5a44", "#a77a9c", "#f0a07c"] },
  ];

  const MIN_VISIBLE_INTENSITY = 0.15;

  const TIMER_STEPS = [0, 3, 5, 10];

  const $ = (id) => document.getElementById(id);
  const screenCamera = $("screen-camera");
  const screenResult = $("screen-result");
  const canvas = $("view");
  const video = $("source-video");
  const stage = $("stage");
  const hint = $("stage-hint");
  const overlay = $("overlay");
  const vfEl = $("viewfinder");
  const vfLabel = $("vf-label");
  const stripTabs = document.querySelectorAll(".strip-tab");
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
  let stripKind = "filter";
  let counting = null;
  let dirty = true;
  let activeScreen = "camera";
  let resultBlob = null;
  let resultUrl = null;
  let toastTimer = null;
  let cameraToken = 0;
  let framesDrawn = 0;
  let lastRenderError = "";
  const lab = { open: false, editingId: null, name: "", chip: ["#e9d9cf", "#b89d8c"], p: normalizeParams({}) };

  const renderer = createRenderer(canvas);

  /* ---------- face (reshape + makeup) ---------- */

  const FaceKit = window.ThaiSuayFace;
  const face = {
    tracker: FaceKit ? FaceKit.createTracker() : null,
    mask: FaceKit ? FaceKit.createMask() : null,
    fx: FaceKit ? FaceKit.createMask() : null,
    hasFx: false,
    ready: false,
    loading: false,
    failed: false,
    geo: null,
    hasMask: false,
    lastDetect: 0,
    statusText: "",
    imageToken: 0,
  };

  const faceFeaturesOn = () =>
    Boolean(
      settings.makeup.lip ||
        settings.makeup.blush ||
        settings.makeup.shadow ||
        Object.values(settings.face).some((v) => Math.abs(v) > 0.001) ||
        Object.values(settings.skin).some((v) => v > 0.01)
    );

  function setFaceStatus(text) {
    if (text === face.statusText) return;
    face.statusText = text;
    const el = document.getElementById("face-status");
    if (el) el.textContent = text;
  }

  function currentAspect() {
    const size = sourceSize();
    return size.w > 0 && size.h > 0 ? size.w / size.h : 1;
  }

  function applyFacePoints(pts) {
    if (!pts) {
      face.geo = null;
      face.hasMask = false;
      face.hasFx = false;
      setFaceStatus(faceFeaturesOn() ? "ไม่พบใบหน้า" : "");
      dirty = true;
      return;
    }
    const asp = currentAspect();
    face.geo = { ...FaceKit.geometry(pts, asp), asp };
    face.hasMask = FaceKit.drawMakeup(face.mask, pts, asp, { ...settings.makeup, contour: settings.skin.contour });
    if (face.hasMask && renderer) renderer.uploadMask(face.mask.canvas);
    face.hasFx = FaceKit.drawFx(face.fx, pts, asp, settings.skin);
    if (face.hasFx && renderer) renderer.uploadFx(face.fx.canvas);
    setFaceStatus("พบใบหน้า");
    dirty = true;
  }

  async function detectImageFace() {
    if (!face.ready || mode !== "image" || !imageSource) return;
    const token = ++face.imageToken;
    try {
      const raw = await FaceKit.detectImage(imageSource);
      if (token !== face.imageToken || mode !== "image") return;
      face.tracker.reset();
      applyFacePoints(face.tracker.update(raw));
    } catch (err) {
      console.warn(err);
    }
  }

  async function ensureFace() {
    if (!FaceKit || face.ready || face.loading || !faceFeaturesOn()) return;
    face.loading = true;
    setFaceStatus("กำลังโหลดโมเดลใบหน้า…");
    try {
      await FaceKit.load();
      await FaceKit.setMode(mode === "image" ? "IMAGE" : "VIDEO");
      face.ready = true;
      face.failed = false;
      setFaceStatus("");
      if (mode === "image") detectImageFace();
    } catch (err) {
      console.warn(err);
      face.failed = true;
      setFaceStatus("เครื่องนี้ใช้ปรับหน้าไม่ได้");
      toast("โหลดตัวปรับโครงหน้าไม่สำเร็จ ลองเปิดใหม่อีกครั้ง");
    } finally {
      face.loading = false;
    }
  }

  function refreshFace() {
    if (!faceFeaturesOn()) {
      face.geo = null;
      face.hasMask = false;
      face.hasFx = false;
      setFaceStatus("");
      dirty = true;
      return;
    }
    ensureFace();
    if (face.ready && face.tracker.points) applyFacePoints(face.tracker.points);
    else if (face.ready && mode === "image") detectImageFace();
    dirty = true;
  }

  function resetFaceTracking() {
    face.imageToken += 1;
    face.tracker?.reset();
    face.geo = null;
    face.hasMask = false;
    face.hasFx = false;
    if (face.ready && mode === "camera") FaceKit.setMode("VIDEO").catch(() => {});
  }

  function trackFaceInVideo() {
    if (!face.ready || mode !== "camera" || !faceFeaturesOn()) return;
    const now = performance.now();
    if (now - face.lastDetect < 55) return;
    face.lastDetect = now;
    try {
      const raw = FaceKit.detectVideo(video, now);
      if (raw === undefined) return;
      applyFacePoints(face.tracker.update(raw));
    } catch (err) {
      console.warn(err);
    }
  }

  /* ---------- settings ---------- */

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const merged = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
      ["smooth", "glow", "intensity"].forEach((key) => {
        const v = Number(merged[key]);
        merged[key] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_SETTINGS[key];
      });
      if (merged.intensity < MIN_VISIBLE_INTENSITY) merged.intensity = DEFAULT_SETTINGS.intensity;
      merged.face = sanitizeFace(merged.face);
      merged.makeup = sanitizeMakeup(merged.makeup);
      merged.skin = sanitizeSkin(merged.skin);
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS, face: sanitizeFace(null), makeup: sanitizeMakeup(null), skin: sanitizeSkin(null) };
    }
  }

  function sanitizeFace(f) {
    const out = {};
    FACE_SLIDERS.forEach(({ key, min }) => {
      const v = Number(f?.[key]);
      out[key] = Number.isFinite(v) ? clamp(v, min / 100, 1) : 0;
    });
    return out;
  }

  function sanitizeSkin(k) {
    const out = {};
    SKIN_SLIDERS.forEach(({ key }) => {
      const v = Number(k?.[key]);
      out[key] = Number.isFinite(v) ? clamp(v, 0, 1) : 0;
    });
    return out;
  }

  function sanitizeMakeup(m) {
    const out = { amount: 0.55 };
    const amount = Number(m?.amount);
    if (Number.isFinite(amount)) out.amount = clamp(amount, 0.1, 1);
    MAKEUP_ROWS.forEach(({ key, colors }) => {
      out[key] = colors.includes(m?.[key]) ? m[key] : "";
    });
    return out;
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
      uniform vec4 u_face;
      uniform vec2 u_fc;
      uniform vec2 u_fax;
      uniform vec4 u_fy;
      uniform vec3 u_eyeA;
      uniform vec3 u_eyeB;
      uniform vec4 u_nose;
      uniform vec4 u_rs;
      uniform float u_eyes;
      uniform sampler2D u_mask;
      uniform float u_maskOn;
      uniform vec3 u_mouth;
      uniform vec2 u_fh;
      uniform vec4 u_rs2;
      uniform sampler2D u_fx;
      uniform float u_fxOn;
      uniform vec3 u_look;

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

      vec2 magnify(vec2 l, vec3 e) {
        vec2 d = l - e.xy;
        float len = length(d);
        if (len < e.z) {
          float k = 1.0 - len / e.z;
          l = e.xy + d * (1.0 - u_eyes * 0.28 * k * k * (3.0 - 2.0 * k));
        }
        return l;
      }

      vec2 reshape(vec2 uv) {
        if (u_face.x < 0.5) return uv;
        vec2 asp = vec2(u_face.y, 1.0);
        vec2 ay = vec2(-u_fax.y, u_fax.x);
        vec2 p = (uv - u_fc) * asp;
        vec2 l = vec2(dot(p, u_fax), dot(p, ay)) / u_face.z;

        float t = (u_fy.x - l.y) / max(u_fy.x - u_fy.y, 0.2);
        float ax = abs(l.x);
        float side = smoothstep(0.1, 0.5, ax) * (1.0 - smoothstep(0.5, 0.85, ax));
        float wSlim = smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(0.8, 1.05, t));
        float wJaw = smoothstep(0.45, 0.85, t) * (1.0 - smoothstep(0.95, 1.12, t));
        l.x += l.x * side * (u_rs.x * 0.14 * wSlim + u_rs.y * 0.15 * wJaw);

        vec2 dc = l - vec2(u_fy.z, u_fy.y);
        l.y += u_rs.z * 0.12 * exp(-dot(dc, dc) / 0.157);

        vec2 dn = l - u_nose.xy;
        float wn = (1.0 - smoothstep(0.0, 1.0, abs(dn.x) / (u_nose.z * 2.0)))
                 * (1.0 - smoothstep(0.0, 1.0, abs(dn.y) / u_nose.w));
        l.x += dn.x * u_rs.w * 0.22 * wn;

        if (u_eyes > 0.001) {
          l = magnify(l, u_eyeA);
          l = magnify(l, u_eyeB);
        }

        vec2 dm = l - u_mouth.xy;
        float lm = length(dm);
        if (lm < u_mouth.z) {
          float k = 1.0 - lm / u_mouth.z;
          l = u_mouth.xy + dm * (1.0 - u_rs2.x * 0.2 * k * k * (3.0 - 2.0 * k));
        }

        vec2 df = l - u_fh;
        l.y -= u_rs2.y * 0.1 * exp(-dot(df, df) / 0.2);

        vec2 p2 = (u_fax * l.x + ay * l.y) * u_face.z;
        return u_fc + p2 / asp;
      }

      void main() {
        vec2 uv = (v_uv - 0.5) * u_crop + 0.5;
        if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
        uv = reshape(uv);

        vec3 orig;
        if (u_look.z > 0.001) {
          vec2 off = (uv - 0.5) * u_look.z * 0.012;
          orig = vec3(texture2D(u_tex, uv + off).r, texture2D(u_tex, uv).g, texture2D(u_tex, uv - off).b);
        } else {
          orig = texture2D(u_tex, uv).rgb;
        }
        vec3 c = orig;
        float mask = skinMask(orig);

        if (u_smooth > 0.001) {
          vec3 sm = smoothSkin(uv, orig);
          c = mix(orig, sm, clamp(mask * u_smooth * 1.4, 0.0, 1.0));
        }
        c += mask * u_glow * 0.1 * (1.0 - c);

        vec2 sp = u_texel * 1.5;
        vec3 blur4 = (texture2D(u_tex, uv + vec2(sp.x, 0.0)).rgb + texture2D(u_tex, uv - vec2(sp.x, 0.0)).rgb
                    + texture2D(u_tex, uv + vec2(0.0, sp.y)).rgb + texture2D(u_tex, uv - vec2(0.0, sp.y)).rgb) * 0.25;
        vec3 detail = (orig - blur4) * 0.55 * (1.0 - mask * 0.75);

        if (u_maskOn > 0.5) {
          vec4 m = texture2D(u_mask, uv);
          if (m.a > 0.003) {
            vec3 col = m.rgb / m.a;
            vec3 target = col * clamp(luma(c) * 1.25 + 0.2, 0.0, 1.15);
            c = mix(c, target, m.a);
          }
        }

        if (u_fxOn > 0.5) {
          vec3 fx = texture2D(u_fx, uv).rgb;
          if (fx.r > 0.003) {
            float teeth = smoothstep(0.35, 0.62, luma(c));
            vec3 white = mix(c, vec3(luma(c)), 0.5) * 1.1;
            c = mix(c, white, fx.r * teeth);
          }
          if (fx.g > 0.003) {
            c = c + (1.0 - c) * fx.g * 0.3;
            c = mix(c, vec3(luma(c)), fx.g * 0.2);
          }
          if (fx.b > 0.003) {
            c += fx.b * 0.22 * (1.0 - c) * vec3(1.0, 0.97, 0.94);
          }
        }

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

        g = clamp(g + detail, 0.0, 1.0);
        g = mix(g, g * g * (3.0 - 2.0 * g), 0.28);
        g = clamp((g - 0.022) / 0.96, 0.0, 1.0);
        float chroma = max(max(g.r, g.g), g.b) - min(min(g.r, g.g), g.b);
        g = mix(vec3(luma(g)), g, 1.0 + 0.18 * (1.0 - chroma) * (1.0 - u_mono));

        g = u_fade + g * (1.0 - u_fade);

        vec2 q = (v_uv - 0.5) * vec2(1.0, 1.15);
        g *= 1.0 - u_vig * smoothstep(0.3, 0.85, length(q));

        float n = fract(sin(dot(v_uv * 997.0 + u_seed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        g += n * u_grain;

        c = mix(c, g, u_intensity);

        if (u_look.x > 0.001) {
          vec3 hi = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.7854;
            vec2 off = vec2(cos(a), sin(a)) * u_radius * 2.2 * u_texel;
            hi += max(texture2D(u_tex, uv + off).rgb - 0.62, 0.0);
          }
          c += hi * 0.125 * u_look.x * 2.2 * vec3(1.0, 0.93, 0.86);
        }
        if (u_look.y > 0.001) {
          float lk = smoothstep(0.62, 0.0, distance(v_uv, vec2(0.0, 0.72)));
          float lk2 = smoothstep(0.4, 0.0, distance(v_uv, vec2(1.0, 0.1))) * 0.6;
          vec3 leak = vec3(1.0, 0.42, 0.18) * lk + vec3(1.0, 0.7, 0.3) * lk2;
          c = 1.0 - (1.0 - c) * (1.0 - leak * u_look.y * 0.9);
        }

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
      "u_face", "u_fc", "u_fax", "u_fy", "u_eyeA", "u_eyeB", "u_nose", "u_rs", "u_eyes",
      "u_mask", "u_maskOn", "u_mouth", "u_fh", "u_rs2", "u_fx", "u_fxOn", "u_look",
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });
    gl.uniform1i(uniforms.u_tex, 0);

    const maskTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const fxTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fxTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(uniforms.u_mask, 1);
    gl.uniform1i(uniforms.u_fx, 2);

    return {
      info() {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown GPU";
      },
      setSize(w, h) {
        if (target.width !== w || target.height !== h) {
          target.width = w;
          target.height = h;
        }
        gl.viewport(0, 0, w, h);
      },
      uploadMask(source) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, maskTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.activeTexture(gl.TEXTURE0);
      },
      uploadFx(source) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, fxTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.activeTexture(gl.TEXTURE0);
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
        const fc = p.face;
        gl.uniform4f(uniforms.u_face, fc ? 1 : 0, fc ? fc.asp : 1, fc ? fc.width : 1, 0);
        gl.uniform1f(uniforms.u_maskOn, p.maskOn ? 1 : 0);
        gl.uniform1f(uniforms.u_fxOn, p.fxOn ? 1 : 0);
        gl.uniform3f(uniforms.u_look, p.look.bloom, p.look.leak, p.look.aber);
        if (fc) {
          gl.uniform2f(uniforms.u_fc, fc.center[0], fc.center[1]);
          gl.uniform2f(uniforms.u_fax, fc.axis[0], fc.axis[1]);
          gl.uniform4f(uniforms.u_fy, fc.eyeY, fc.chin[1], fc.chin[0], 0);
          gl.uniform3f(uniforms.u_eyeA, fc.eyeL[0], fc.eyeL[1], fc.eyeL[2]);
          gl.uniform3f(uniforms.u_eyeB, fc.eyeR[0], fc.eyeR[1], fc.eyeR[2]);
          gl.uniform4f(uniforms.u_nose, fc.nose[0], fc.nose[1], fc.nose[2], fc.nose[3]);
          gl.uniform4f(uniforms.u_rs, p.reshape.slim, p.reshape.jaw, p.reshape.chin, p.reshape.nose);
          gl.uniform1f(uniforms.u_eyes, p.reshape.eyes);
          gl.uniform3f(uniforms.u_mouth, fc.mouth[0], fc.mouth[1], fc.mouth[2]);
          gl.uniform2f(uniforms.u_fh, fc.forehead[0], fc.forehead[1]);
          gl.uniform4f(uniforms.u_rs2, p.reshape.mouth, p.reshape.forehead, 0, 0);
        }
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

  function findFilter(id) {
    const list = allFilters();
    return list.find((f) => f.id === id) || list[0];
  }

  function currentFilter() {
    if (lab.open) return lab.p;
    return findFilter(settings.filter).p;
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
      face: !original && face.geo && faceFeaturesOn() ? face.geo : null,
      maskOn: !original && face.hasMask && Boolean(face.geo),
      fxOn: !original && face.hasFx && Boolean(face.geo),
      reshape: settings.face,
      look: original || lab.open ? { bloom: 0, leak: 0, aber: 0 } : findFilter(settings.filter).fx,
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

    try {
      const size = sourceSize();
      const dims = outputDims(PREVIEW_WIDTH, size);
      renderer.setSize(dims.w, dims.h);
      renderer.upload(isVideo ? video : imageSource);
      if (isVideo) trackFaceInVideo();
      renderer.draw(drawParams(size, comparing));
      framesDrawn += 1;
      lastRenderError = "";
    } catch (err) {
      lastRenderError = String(err?.message || err).slice(0, 80);
    }
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
    allFilters()
      .filter((f) => f.kind === stripKind)
      .forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip" + (f.kind === "camera" ? " is-camera" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(f.id === settings.filter));
      btn.dataset.id = f.id;

      const swatch = document.createElement("span");
      swatch.className = "filter-swatch";
      swatch.style.background = `linear-gradient(135deg, ${f.chip[0]}, ${f.chip[1]})`;
      const name = document.createElement("span");
      name.textContent = f.name;

      if (f.kind === "camera") {
        swatch.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/></svg>';
      }
      btn.append(swatch, name);
      btn.addEventListener("click", () => {
        selectFilter(f.id);
        if (settings.intensity < MIN_VISIBLE_INTENSITY) {
          settings.intensity = DEFAULT_SETTINGS.intensity;
          saveSettings();
          syncSliders();
        }
        toast(`${f.kind === "camera" ? "กล้อง" : "ฟิลเตอร์"}: ${f.name}`);
      });
      filterStrip.appendChild(btn);
    });
  }

  function refreshStrip() {
    stripKind = findFilter(settings.filter).kind;
    syncStripTabs();
    renderFilterStrip();
  }

  function syncStripTabs() {
    stripTabs.forEach((t) => {
      const on = t.dataset.kind === stripKind;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", String(on));
    });
  }

  function selectFilter(id) {
    settings.filter = id;
    saveSettings();
    dirty = true;
    const kind = findFilter(id).kind;
    if (kind !== stripKind) {
      stripKind = kind;
      renderFilterStrip();
      syncStripTabs();
    }
    syncOverlay();
    if (lab.open) loadLab(id);
    filterStrip.querySelectorAll(".filter-chip").forEach((el) => {
      const on = el.dataset.id === id;
      el.setAttribute("aria-selected", String(on));
      if (on) centerChip(el);
    });
  }

  function centerChip(el) {
    const strip = filterStrip.getBoundingClientRect();
    const chip = el.getBoundingClientRect();
    filterStrip.scrollLeft += chip.left - strip.left - (strip.width - chip.width) / 2;
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

  function watchFirstFrames(token) {
    const before = framesDrawn;
    setTimeout(() => {
      if (token !== cameraToken || mode !== "camera" || activeScreen !== "camera") return;
      if (framesDrawn === before) {
        setHint("แสดงภาพกล้องพร้อมฟิลเตอร์ไม่ได้บนเบราว์เซอร์นี้ ลองกดแต่งรูป หรืออัปเดตเบราว์เซอร์");
      }
    }, 4000);
  }

  async function startCamera() {
    stopCamera();
    const token = cameraToken;
    mode = "camera";
    imageSource = null;
    resetFaceTracking();
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
      watchFirstFrames(token);
    } catch (err) {
      console.warn(err);
      setHint("ยังเปิดกล้องไม่ได้ อนุญาตสิทธิ์กล้อง หรือกดแต่งรูป");
    }
  }

  /* ---------- overlay: date stamp and frame ---------- */

  const SEGMENTS = {
    0: "abcdef",
    1: "bc",
    2: "abdeg",
    3: "abcdg",
    4: "bcfg",
    5: "acdfg",
    6: "acdefg",
    7: "abc",
    8: "abcdefg",
    9: "abcdfg",
  };

  function drawSevenSegment(ctx, ch, x, y, w, h) {
    const t = w * 0.2;
    const on = SEGMENTS[ch] || "";
    const half = h / 2;
    const rects = {
      a: [x + t * 0.5, y, w - t, t],
      d: [x + t * 0.5, y + h - t, w - t, t],
      g: [x + t * 0.5, y + half - t / 2, w - t, t],
      f: [x, y + t * 0.5, t, half - t * 0.5],
      b: [x + w - t, y + t * 0.5, t, half - t * 0.5],
      e: [x, y + half, t, half - t * 0.5],
      c: [x + w - t, y + half, t, half - t * 0.5],
    };
    for (const seg of on) ctx.fillRect(...rects[seg]);
  }

  function drawDateStamp(ctx, w, h, bottomInset) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const text = `'${pad(d.getFullYear() % 100)} ${pad(d.getMonth() + 1)} ${pad(d.getDate())}`;
    const dw = w * 0.026;
    const dh = dw * 1.85;
    const gap = dw * 0.45;
    const total = text.length * (dw + gap) - gap;
    let x = w - w * 0.05 - total;
    const y = h - bottomInset - h * 0.045 - dh;
    ctx.save();
    ctx.fillStyle = "#ff8a1f";
    ctx.shadowColor = "rgba(255, 110, 0, 0.85)";
    ctx.shadowBlur = dw * 0.7;
    ctx.globalAlpha = 0.93;
    for (const ch of text) {
      if (ch === "'") {
        ctx.beginPath();
        ctx.moveTo(x + dw * 0.55, y);
        ctx.lineTo(x + dw * 0.85, y);
        ctx.lineTo(x + dw * 0.45, y + dh * 0.28);
        ctx.lineTo(x + dw * 0.2, y + dh * 0.28);
        ctx.closePath();
        ctx.fill();
      } else if (ch !== " ") {
        drawSevenSegment(ctx, ch, x, y, dw, dh);
      }
      x += dw + gap;
    }
    ctx.restore();
  }

  function drawOverlay(ctx, w, h, look, clear = true) {
    if (clear) ctx.clearRect(0, 0, w, h);
    if (!look) return;
    let bottomInset = 0;
    if (look.frame === "polaroid") {
      const m = w * 0.055;
      bottomInset = w * 0.2;
      ctx.save();
      ctx.fillStyle = "#f6f1e8";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.rect(m, m, w - m * 2, h - m - bottomInset);
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
      ctx.lineWidth = Math.max(1, w * 0.002);
      ctx.strokeRect(m, m, w - m * 2, h - m - bottomInset);
      ctx.restore();
    }
    if (look.stamp) drawDateStamp(ctx, w, h, bottomInset);
  }

  function activeLook() {
    return lab.open ? null : findFilter(settings.filter);
  }

  function syncOverlay() {
    const look = activeLook();
    const ctx = overlay.getContext("2d");
    if (overlay.width !== 720) {
      overlay.width = 720;
      overlay.height = 960;
    }
    drawOverlay(ctx, overlay.width, overlay.height, look);
    overlay.style.visibility = comparing ? "hidden" : "visible";
    const camera = look?.kind === "camera";
    vfEl.hidden = !camera;
    if (camera) vfLabel.textContent = look.model;
  }

  /* ---------- capture ---------- */

  function renderToBlob() {
    const size = sourceSize();
    const dims = outputDims(CAPTURE_WIDTH, size);
    const previewDims = outputDims(PREVIEW_WIDTH, size);

    renderer.setSize(dims.w, dims.h);
    renderer.upload(mode === "camera" ? video : imageSource);
    renderer.draw(drawParams(size, false));

    const out = document.createElement("canvas");
    out.width = dims.w;
    out.height = dims.h;
    const octx = out.getContext("2d", { willReadFrequently: true });
    octx.drawImage(canvas, 0, 0, dims.w, dims.h);
    drawOverlay(octx, dims.w, dims.h, activeLook(), false);
    return new Promise((resolve) => {
      out.toBlob((blob) => {
        renderer.setSize(previewDims.w, previewDims.h);
        dirty = true;
        resolve(blob);
      }, "image/jpeg", 0.92);
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
    face.tracker?.reset();
    face.imageToken += 1;
    face.geo = null;
    face.hasMask = false;
    refreshFace();
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

  tuneBtn.addEventListener("click", () => setPanelOpen("tune"));

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

  /* ---------- face panel ---------- */

  const facePanel = $("face-panel");
  const faceBtn = $("btn-face");
  const controlsEl = document.querySelector(".controls");
  const faceSliderEls = {};
  const makeupButtons = [];

  function setPanelOpen(which) {
    const tuneOpen = which === "tune" && !tunePanel.classList.contains("is-open");
    const faceOpen = which === "face" && !facePanel.classList.contains("is-open");
    tunePanel.classList.toggle("is-open", tuneOpen);
    tuneBtn.setAttribute("aria-expanded", String(tuneOpen));
    facePanel.classList.toggle("is-open", faceOpen);
    faceBtn.setAttribute("aria-expanded", String(faceOpen));
    controlsEl.classList.toggle("face-open", faceOpen);
    if (faceOpen) {
      syncFacePanel();
      FaceKit?.load().catch(() => {});
      refreshFace();
    }
  }

  const LOOKS = [
    { id: "off", name: "ไม่ใช้", chip: ["#2a2024", "#2a2024"], none: true },
    {
      id: "natural",
      name: "ธรรมชาติ",
      chip: ["#f6dcc9", "#e7b79f"],
      filter: "clean",
      smooth: 0.4,
      glow: 0.3,
      face: { slim: 0.12, jaw: 0.08, eyes: 0.16, nose: 0.08 },
      skin: { teeth: 0.2, dark: 0.3, highlight: 0.2 },
      makeup: { lip: "#d7848a", blush: "#ff9a85", amount: 0.4 },
    },
    {
      id: "sweet",
      name: "หวานใส",
      chip: ["#ffe1e4", "#f59bb0"],
      filter: "milk",
      smooth: 0.55,
      glow: 0.4,
      face: { slim: 0.24, jaw: 0.16, eyes: 0.32, nose: 0.16 },
      skin: { teeth: 0.35, dark: 0.5, highlight: 0.35 },
      makeup: { lip: "#ee6c5a", blush: "#ff9a85", shadow: "#d9948f", amount: 0.5 },
    },
    {
      id: "korean",
      name: "เกาหลี",
      chip: ["#e8f2fb", "#f08aa8"],
      filter: "glass",
      smooth: 0.6,
      glow: 0.45,
      face: { slim: 0.32, jaw: 0.28, chin: -0.08, eyes: 0.28, nose: 0.24, mouth: -0.08 },
      skin: { teeth: 0.3, dark: 0.5, highlight: 0.4, contour: 0.15 },
      makeup: { lip: "#e0567c", blush: "#ff7fa6", shadow: "#a77a9c", amount: 0.5 },
    },
    {
      id: "sharp",
      name: "คมสวย",
      chip: ["#e3e8ee", "#b3283c"],
      filter: "chrome",
      smooth: 0.35,
      glow: 0.2,
      face: { slim: 0.2, jaw: 0.24, chin: 0.08, eyes: 0.16, nose: 0.28 },
      skin: { teeth: 0.3, dark: 0.3, highlight: 0.5, contour: 0.5 },
      makeup: { lip: "#c8283a", blush: "#e86a86", shadow: "#8a5a44", amount: 0.55 },
    },
    {
      id: "sunny",
      name: "แดดสวย",
      chip: ["#fff0c0", "#ffa86a"],
      filter: "sunny",
      smooth: 0.45,
      glow: 0.5,
      face: { slim: 0.16, eyes: 0.2, nose: 0.12 },
      skin: { teeth: 0.3, dark: 0.3, highlight: 0.45, contour: 0.25 },
      makeup: { lip: "#ee6c5a", blush: "#ffa86a", shadow: "#f0a07c", amount: 0.45 },
    },
    {
      id: "rosy",
      name: "ชมพูฟุ้ง",
      chip: ["#ffe4ea", "#e86a86"],
      filter: "blush",
      smooth: 0.55,
      glow: 0.4,
      face: { slim: 0.24, jaw: 0.16, eyes: 0.28, nose: 0.16 },
      skin: { teeth: 0.3, dark: 0.4, highlight: 0.3 },
      makeup: { lip: "#e0567c", blush: "#e86a86", shadow: "#d9948f", amount: 0.55 },
    },
  ];

  function applyLook(look) {
    if (look.none) {
      settings.face = sanitizeFace(null);
      settings.makeup = sanitizeMakeup(null);
      settings.skin = sanitizeSkin(null);
    } else {
      settings.face = sanitizeFace(look.face);
      settings.makeup = sanitizeMakeup({ amount: 0.55, ...look.makeup });
      settings.skin = sanitizeSkin(look.skin);
      settings.smooth = look.smooth;
      settings.glow = look.glow;
      if (allFilters().some((f) => f.id === look.filter)) selectFilter(look.filter);
    }
    saveSettings();
    syncFacePanel();
    syncSliders();
    refreshFace();
    toast(look.none ? "ปิดลุคแล้ว" : `ลุค: ${look.name}`);
  }

  function makeSlider(label, min, onInput) {
    const wrap = document.createElement("label");
    wrap.className = "slider";
    const head = document.createElement("span");
    head.className = "slider-head";
    head.append(label + " ");
    const out = document.createElement("output");
    head.appendChild(out);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = "100";
    input.addEventListener("input", () => {
      out.textContent = input.value;
      onInput(Number(input.value) / 100);
    });
    input.addEventListener("change", saveSettings);
    wrap.append(head, input);
    return { wrap, input, out };
  }

  function buildFacePanel() {
    const looks = $("face-looks");
    LOOKS.forEach((look) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "look-chip";
      const sw = document.createElement("span");
      sw.className = "look-swatch";
      sw.style.background = `linear-gradient(135deg, ${look.chip[0]}, ${look.chip[1]})`;
      if (look.none) sw.textContent = "∅";
      const name = document.createElement("span");
      name.textContent = look.name;
      btn.append(sw, name);
      btn.addEventListener("click", () => applyLook(look));
      looks.appendChild(btn);
    });

    FACE_SLIDERS.forEach(({ key, label, min }) => {
      const { wrap, input, out } = makeSlider(label, min, (v) => {
        settings.face[key] = v;
        refreshFace();
      });
      $("face-shape").appendChild(wrap);
      faceSliderEls[key] = { input, out };
    });

    const smoothS = makeSlider("ผิวเนียน", 0, (v) => {
      settings.smooth = v;
      syncSliders();
      dirty = true;
    });
    const glowS = makeSlider("ผิวใส", 0, (v) => {
      settings.glow = v;
      syncSliders();
      dirty = true;
    });
    $("face-skin").append(smoothS.wrap, glowS.wrap);
    faceSliderEls.smooth = smoothS;
    faceSliderEls.glow = glowS;
    SKIN_SLIDERS.forEach(({ key, label }) => {
      const { wrap, input, out } = makeSlider(label, 0, (v) => {
        settings.skin[key] = v;
        refreshFace();
      });
      $("face-skin").appendChild(wrap);
      faceSliderEls["skin_" + key] = { input, out };
    });

    const body = $("face-makeup");
    MAKEUP_ROWS.forEach(({ key, label, colors }) => {
      const row = document.createElement("div");
      row.className = "makeup-row";
      const name = document.createElement("span");
      name.textContent = label;
      const swatches = document.createElement("div");
      swatches.className = "makeup-swatches";
      ["", ...colors].forEach((hex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "makeup-swatch" + (hex ? "" : " is-none");
        btn.dataset.row = key;
        btn.dataset.color = hex;
        btn.setAttribute("aria-label", hex ? `${label} ${hex}` : `ไม่ใส่${label}`);
        if (hex) btn.style.background = hex;
        else btn.textContent = "ไม่";
        btn.addEventListener("click", () => {
          settings.makeup[key] = hex;
          saveSettings();
          syncFacePanel();
          refreshFace();
        });
        swatches.appendChild(btn);
        makeupButtons.push(btn);
      });
      row.append(name, swatches);
      body.appendChild(row);
    });

    const amount = makeSlider("ความเข้มเมคอัพ", 10, (v) => {
      settings.makeup.amount = v;
      refreshFace();
    });
    body.appendChild(amount.wrap);
    faceSliderEls.amount = amount;

    const bodies = { looks, shape: $("face-shape"), skin: $("face-skin"), makeup: body };
    document.querySelectorAll(".face-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".face-tab").forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-on", on);
          t.setAttribute("aria-selected", String(on));
        });
        Object.entries(bodies).forEach(([name, el]) => {
          el.hidden = name !== tab.dataset.tab;
        });
      });
    });

    $("btn-face-reset").addEventListener("click", () => applyLook(LOOKS[0]));
  }

  function setSlider(el, value) {
    const v = Math.round(value * 100);
    el.input.value = String(v);
    el.out.textContent = String(v);
  }

  function syncFacePanel() {
    FACE_SLIDERS.forEach(({ key }) => setSlider(faceSliderEls[key], settings.face[key]));
    SKIN_SLIDERS.forEach(({ key }) => setSlider(faceSliderEls["skin_" + key], settings.skin[key]));
    setSlider(faceSliderEls.smooth, settings.smooth);
    setSlider(faceSliderEls.glow, settings.glow);
    setSlider(faceSliderEls.amount, settings.makeup.amount);
    makeupButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(settings.makeup[btn.dataset.row] === btn.dataset.color));
    });
  }

  buildFacePanel();
  syncFacePanel();
  faceBtn.addEventListener("click", () => setPanelOpen("face"));

  $("btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", onImport);
  exitEditBtn.addEventListener("click", backToCamera);

  const startCompare = (e) => {
    if (e.target === exitEditBtn) return;
    comparing = true;
    badge.hidden = false;
    overlay.style.visibility = "hidden";
    dirty = true;
  };
  const endCompare = () => {
    if (!comparing) return;
    comparing = false;
    badge.hidden = true;
    overlay.style.visibility = "visible";
    dirty = true;
  };
  stage.addEventListener("pointerdown", startCompare);
  stage.addEventListener("pointerleave", endCompare);
  window.addEventListener("pointerup", endCompare);
  window.addEventListener("pointercancel", endCompare);
  window.addEventListener("touchend", endCompare);
  window.addEventListener("touchcancel", endCompare);
  window.addEventListener("blur", endCompare);
  filterStrip.addEventListener("pointerdown", endCompare);
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

  /* ---------- filter lab (developer mode: ?dev=1) ---------- */

  const labEls = {
    panel: $("lab-panel"),
    name: $("lab-name"),
    c1: $("lab-c1"),
    c2: $("lab-c2"),
    sliders: $("lab-sliders"),
    save: $("btn-lab-save"),
    copy: $("btn-lab-copy"),
    del: $("btn-lab-delete"),
    close: $("btn-lab-close"),
    open: $("btn-lab"),
  };
  const labRows = {};

  const fmt = (v) => Number(v).toFixed(2);

  function buildLabSliders() {
    PARAMS.forEach(({ key, label, min, max, step }) => {
      const row = document.createElement("label");
      row.className = "slider";
      const head = document.createElement("span");
      head.className = "slider-head";
      head.append(label);
      const out = document.createElement("output");
      head.appendChild(out);
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.addEventListener("input", () => {
        lab.p[key] = Number(input.value);
        out.textContent = fmt(input.value);
        dirty = true;
      });
      row.append(head, input);
      labEls.sliders.appendChild(row);
      labRows[key] = { input, out };
    });
  }

  function syncLabUi() {
    labEls.name.value = lab.name;
    labEls.c1.value = lab.chip[0];
    labEls.c2.value = lab.chip[1];
    PARAMS.forEach(({ key }) => {
      labRows[key].input.value = String(lab.p[key]);
      labRows[key].out.textContent = fmt(lab.p[key]);
    });
    labEls.del.hidden = !lab.editingId;
  }

  function loadLab(id) {
    const f = findFilter(id);
    lab.p = { ...f.p };
    lab.chip = [...f.chip];
    lab.editingId = f.custom ? f.id : null;
    lab.name = f.custom ? f.name : `${f.name} 2`;
    syncLabUi();
    dirty = true;
  }

  function openLab() {
    tunePanel.classList.remove("is-open");
    tuneBtn.setAttribute("aria-expanded", "false");
    facePanel.classList.remove("is-open");
    faceBtn.setAttribute("aria-expanded", "false");
    controlsEl.classList.remove("face-open");
    lab.open = true;
    labEls.panel.hidden = false;
    syncOverlay();
    loadLab(settings.filter);
  }

  function closeLab() {
    lab.open = false;
    labEls.panel.hidden = true;
    syncOverlay();
    dirty = true;
  }

  function labSnapshot(id) {
    const p = {};
    PARAMS.forEach(({ key }) => {
      p[key] = Math.round(lab.p[key] * 1000) / 1000;
    });
    return {
      id,
      name: labEls.name.value.trim().slice(0, 20) || "ฟิลเตอร์ของฉัน",
      chip: [labEls.c1.value, labEls.c2.value],
      p,
    };
  }

  function saveLabFilter() {
    lab.chip = [labEls.c1.value, labEls.c2.value];
    const id = lab.editingId || `custom-${Date.now().toString(36)}`;
    const next = normalizeFilter(labSnapshot(id), true);
    const i = customFilters.findIndex((f) => f.id === id);
    if (i >= 0) customFilters[i] = next;
    else customFilters.push(next);
    saveCustomFilters();
    lab.editingId = id;
    lab.name = next.name;
    settings.filter = id;
    saveSettings();
    refreshStrip();
    selectFilter(id);
    toast("บันทึกฟิลเตอร์ในเครื่องแล้ว");
  }

  function deleteLabFilter() {
    if (!lab.editingId) return;
    customFilters = customFilters.filter((f) => f.id !== lab.editingId);
    saveCustomFilters();
    settings.filter = builtinFilters[0].id;
    saveSettings();
    refreshStrip();
    selectFilter(settings.filter);
    toast("ลบฟิลเตอร์แล้ว");
  }

  function labCode() {
    const slug =
      labEls.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-filter";
    const snap = labSnapshot(slug);
    const body = PARAMS.filter(({ key, def }) => snap.p[key] !== def)
      .map(({ key }) => `${key}: ${snap.p[key]}`)
      .join(", ");
    return [
      "{",
      `  id: ${JSON.stringify(snap.id)},`,
      `  name: ${JSON.stringify(snap.name)},`,
      `  chip: ${JSON.stringify(snap.chip)},`,
      `  p: { ${body} },`,
      "},",
    ].join("\n");
  }

  const toBase64Url = (text) =>
    btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromBase64Url = (text) =>
    decodeURIComponent(escape(atob(text.replace(/-/g, "+").replace(/_/g, "/"))));

  function shareLink() {
    const snap = labSnapshot("shared");
    const payload = toBase64Url(JSON.stringify({ name: snap.name, chip: snap.chip, p: snap.p }));
    return `${location.origin}${location.pathname}#filter=${payload}`;
  }

  async function copyShareLink() {
    const link = shareLink();
    try {
      await navigator.clipboard.writeText(link);
      toast("คัดลอกลิงก์แล้ว เปิดบนมือถือเพื่อนำเข้า");
    } catch {
      window.prompt("คัดลอกลิงก์นี้ไปเปิดบนมือถือ", link);
    }
  }

  function importFilterFromHash() {
    const match = /^#filter=([A-Za-z0-9_-]{1,3000})$/.exec(location.hash);
    if (!match) return;
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const data = JSON.parse(fromBase64Url(match[1]));
      const key = JSON.stringify([data.name, data.chip, data.p]);
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
      const id = `shared-${hash.toString(36)}`;
      const filter = normalizeFilter({ ...data, id }, true);
      if (!customFilters.some((f) => f.id === id)) {
        customFilters.push(filter);
        saveCustomFilters();
      }
      settings.filter = id;
      saveSettings();
      return filter.name;
    } catch {
      return null;
    }
  }

  async function copyLabCode() {
    const text = labCode();
    try {
      await navigator.clipboard.writeText(text);
      toast("คัดลอกโค้ดแล้ว วางใน filters.js");
    } catch {
      window.prompt("คัดลอกโค้ดนี้ไปวางใน filters.js", text);
    }
  }

  const toHex = (r, g, b) =>
    "#" + [r, g, b].map((v) => clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, "0")).join("");

  /*
   * Estimates filter parameters from a reference photo by comparing its colour
   * statistics with those of a typical neutral photo. It is an approximation and
   * is biased by scene content (a photo of a red wall reads as "warm").
   * Each formula inverts the matching step of the shader's grade.
   */
  function analyzeReference(src) {
    const scale = Math.min(1, 160 / Math.max(src.width, src.height));
    const w = Math.max(8, Math.round(src.width * scale));
    const h = Math.max(8, Math.round(src.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const n = w * h;
    const luma = new Float32Array(n);
    let sumL = 0;
    let sumL2 = 0;
    for (let i = 0; i < n; i++) {
      const l = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
      luma[i] = l;
      sumL += l;
      sumL2 += l * l;
    }
    const meanL = sumL / n;
    const std = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
    const sorted = Float32Array.from(luma).sort();
    const median = sorted[Math.floor(n / 2)];
    const black = sorted[Math.floor(n * 0.01)];

    let mid = { r: 0, g: 0, b: 0, chroma: 0, count: 0 };
    let light = { r: 0, g: 0, b: 0, count: 0 };
    let dark = { r: 0, g: 0, b: 0, count: 0 };
    for (let i = 0; i < n; i++) {
      const r = data[i * 4] / 255;
      const g = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;
      const l = luma[i];
      if (l > 0.08 && l < 0.92) {
        mid.r += r;
        mid.g += g;
        mid.b += b;
        mid.chroma += Math.max(r, g, b) - Math.min(r, g, b);
        mid.count++;
      }
      const bucket = l >= median ? light : dark;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    }
    if (mid.count < n * 0.1) {
      mid = { r: meanL, g: meanL, b: meanL, chroma: 0, count: 1 };
    }
    const mr = mid.r / mid.count;
    const mg = mid.g / mid.count;
    const mb = mid.b / mid.count;
    const chroma = mid.chroma / mid.count;

    const boxMean = (x0, y0, x1, y1) => {
      let s = 0;
      let k = 0;
      for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) {
        for (let x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) {
          s += luma[y * w + x];
          k++;
        }
      }
      return k ? s / k : meanL;
    };
    const centre = boxMean(0.3, 0.3, 0.7, 0.7);
    const corners =
      (boxMean(0, 0, 0.2, 0.2) + boxMean(0.8, 0, 1, 0.2) + boxMean(0, 0.8, 0.2, 1) + boxMean(0.8, 0.8, 1, 1)) / 4;

    const isMono = chroma < 0.03;
    const fade = black > 0.03 ? clamp(black, 0, 0.3) : 0;
    const lift = (meanL - fade) / (1 - fade);
    const vigRaw = centre > 0.05 ? (1 - corners / centre) / 0.9 : 0;

    const p = normalizeParams({
      exposure: Math.log2(Math.max(lift, 0.02) / 0.45) * 0.7,
      contrast: std / (1 - fade) / 0.22,
      sat: isMono ? 1 : chroma / 0.2,
      temp: (mr - mb - 0.04) / 0.16,
      tint: -(mg - (mr + mb) / 2) / 0.065,
      fade,
      vig: vigRaw > 0.15 ? vigRaw : 0,
      grain: 0,
      mono: isMono ? 1 : 0,
    });
    p.exposure = clamp(p.exposure, -0.6, 0.6);

    const lc = light.count || 1;
    const dc = dark.count || 1;
    return {
      p,
      chip: [toHex(light.r / lc, light.g / lc, light.b / lc), toHex(dark.r / dc, dark.g / dc, dark.b / dc)],
    };
  }

  async function onReferencePicked(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const img = await loadImage(file);
      const result = analyzeReference(img);
      lab.p = result.p;
      lab.chip = result.chip;
      lab.editingId = null;
      lab.name = "จากรูปอ้างอิง";
      syncLabUi();
      dirty = true;
      toast("สร้างจากรูปอ้างอิงแล้ว ปรับต่อได้เลย");
    } catch {
      toast("เปิดรูปนี้ไม่ได้");
    }
  }

  if (DEV_MODE) {
    const refInput = $("lab-ref-input");
    $("btn-lab-ref").addEventListener("click", () => refInput.click());
    refInput.addEventListener("change", () => onReferencePicked(refInput));
    buildLabSliders();
    labEls.open.hidden = false;
    labEls.open.addEventListener("click", () => (lab.open ? closeLab() : openLab()));
    labEls.close.addEventListener("click", closeLab);
    labEls.save.addEventListener("click", saveLabFilter);
    labEls.copy.addEventListener("click", copyLabCode);
    $("btn-lab-link").addEventListener("click", copyShareLink);
    labEls.del.addEventListener("click", deleteLabFilter);
    labEls.c1.addEventListener("input", () => {
      lab.chip[0] = labEls.c1.value;
    });
    labEls.c2.addEventListener("input", () => {
      lab.chip[1] = labEls.c2.value;
    });
  }

  /* ---------- boot ---------- */

  const importedName = importFilterFromHash();
  if (!allFilters().some((f) => f.id === settings.filter)) {
    settings.filter = DEFAULT_SETTINGS.filter;
    saveSettings();
  }
  refreshStrip();
  syncOverlay();
  stripTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      stripKind = tab.dataset.kind;
      syncStripTabs();
      renderFilterStrip();
      const selected = filterStrip.querySelector('[aria-selected="true"]');
      if (selected) centerChip(selected);
    });
  });
  if (importedName) toast(`นำเข้าฟิลเตอร์ "${importedName}" แล้ว`);
  else if (importedName === null) toast("ลิงก์ฟิลเตอร์ไม่ถูกต้อง");

  if (DEV_MODE && renderer) {
    const debugEl = $("stage-debug");
    debugEl.hidden = false;
    const gpu = renderer.info();
    let lastFrames = 0;
    setInterval(() => {
      const fps = (framesDrawn - lastFrames) * 2;
      lastFrames = framesDrawn;
      const f = findFilter(settings.filter);
      debugEl.textContent =
        `${gpu} | ${canvas.width}x${canvas.height} | ${f.id} | ฟิลเตอร์ ${Math.round(settings.intensity * 100)}% | ${fps}fps` +
        ` | video ${video.readyState} ${video.videoWidth}x${video.videoHeight} | compare ${comparing}` +
        (lastRenderError ? ` | error ${lastRenderError}` : "");
    }, 500);
  }
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
  if (selected) centerChip(selected);
})();
