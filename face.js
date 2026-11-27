/*
 * Face landmarks, face-reshape geometry and makeup mask for ถ่ายสวย.
 *
 * Landmarks come from MediaPipe Face Landmarker (vendored in vendor/mediapipe,
 * runs on-device). Everything here is plain JS; app.js feeds the results to
 * the WebGL shader.
 *
 * Coordinates: landmarks are normalised image coords (x right, y down).
 * "Texture space" flips y (y up) to match the WebGL texture.
 */
(() => {
  const BASE = new URL("vendor/mediapipe/", document.baseURI).href;

  const LM = {
    faceLeft: 234,
    faceRight: 454,
    chin: 152,
    eyeLOuter: 33,
    eyeLInner: 133,
    eyeROuter: 263,
    eyeRInner: 362,
    noseL: 129,
    noseR: 358,
    cheekL: 205,
    cheekR: 425,
    mouthL: 61,
    mouthR: 291,
    lipTop: 13,
    lipBottom: 14,
    forehead: 10,
    bridge: 168,
    noseTip: 1,
    jawL: 172,
    jawR: 397,
    lowerLidL: 145,
    lowerLidR: 374,
  };

  const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
  const LID_L = [33, 246, 161, 160, 159, 158, 157, 173, 133];
  const LID_R = [362, 398, 384, 385, 386, 387, 388, 466, 263];

  const MASK_WIDTH = 384;

  let landmarker = null;
  let loading = null;
  let currentMode = "VIDEO";

  async function load() {
    if (landmarker) return landmarker;
    if (!loading) {
      loading = (async () => {
        const vision = await import(BASE + "vision_bundle.js");
        const fileset = await vision.FilesetResolver.forVisionTasks(BASE + "wasm");
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: BASE + "face_landmarker.task", delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.4,
          minFacePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
        currentMode = "VIDEO";
        return landmarker;
      })().catch((err) => {
        loading = null;
        throw err;
      });
    }
    return loading;
  }

  async function setMode(mode) {
    const lm = await load();
    if (currentMode !== mode) {
      await lm.setOptions({ runningMode: mode });
      currentMode = mode;
    }
  }

  function firstFace(result) {
    const face = result?.faceLandmarks?.[0];
    if (!face || face.length < 468) return null;
    const out = new Float32Array(face.length * 2);
    for (let i = 0; i < face.length; i++) {
      out[i * 2] = face[i].x;
      out[i * 2 + 1] = face[i].y;
    }
    return out;
  }

  function detectVideo(video, now) {
    if (!landmarker || currentMode !== "VIDEO") return undefined;
    return firstFace(landmarker.detectForVideo(video, now));
  }

  async function detectImage(source) {
    await setMode("IMAGE");
    return firstFace(landmarker.detect(source));
  }

  /* Smooths landmarks over time; drops the face after a few missed frames. */
  function createTracker() {
    let pts = null;
    let missed = 0;
    return {
      update(raw) {
        if (!raw) {
          missed += 1;
          if (missed > 8) pts = null;
          return pts;
        }
        missed = 0;
        if (!pts || pts.length !== raw.length) {
          pts = raw.slice();
          return pts;
        }
        const span = Math.hypot(raw[LM.faceRight * 2] - raw[LM.faceLeft * 2], raw[LM.faceRight * 2 + 1] - raw[LM.faceLeft * 2 + 1]);
        const jump = Math.hypot(raw[LM.chin * 2] - pts[LM.chin * 2], raw[LM.chin * 2 + 1] - pts[LM.chin * 2 + 1]);
        const a = jump > span * 0.35 ? 1 : 0.55;
        for (let i = 0; i < raw.length; i++) pts[i] += (raw[i] - pts[i]) * a;
        return pts;
      },
      reset() {
        pts = null;
        missed = 0;
      },
      get points() {
        return pts;
      },
    };
  }

  /*
   * Face-local frame for the shader. Units are the face width W (distance
   * between the cheek edges), measured in image-height units so that
   * rotations stay square on non-square images.
   */
  function geometry(pts, asp) {
    const px = (i) => pts[i * 2];
    const py = (i) => 1 - pts[i * 2 + 1];
    const cx = (px(LM.faceLeft) + px(LM.faceRight)) / 2;
    const cy = (py(LM.faceLeft) + py(LM.faceRight)) / 2;
    const dx = (px(LM.faceRight) - px(LM.faceLeft)) * asp;
    const dy = py(LM.faceRight) - py(LM.faceLeft);
    const W = Math.hypot(dx, dy) || 1e-3;
    const ax = [dx / W, dy / W];
    const ay = [-ax[1], ax[0]];
    const local = (x, y) => {
      const ux = (x - cx) * asp;
      const uy = y - cy;
      return [(ux * ax[0] + uy * ax[1]) / W, (ux * ay[0] + uy * ay[1]) / W];
    };
    const mid = (a, b) => [(px(a) + px(b)) / 2, (py(a) + py(b)) / 2];
    const eyeL = mid(LM.eyeLOuter, LM.eyeLInner);
    const eyeR = mid(LM.eyeROuter, LM.eyeRInner);
    const eyeLocalL = local(eyeL[0], eyeL[1]);
    const eyeLocalR = local(eyeR[0], eyeR[1]);
    const eyeW =
      Math.hypot((px(LM.eyeLOuter) - px(LM.eyeLInner)) * asp, py(LM.eyeLOuter) - py(LM.eyeLInner)) / W;
    const eyeRad = Math.max(0.12, eyeW * 1.25);
    const chin = local(px(LM.chin), py(LM.chin));
    const noseMid = mid(LM.noseL, LM.noseR);
    const nose = local(noseMid[0], noseMid[1]);
    const noseHalf =
      Math.hypot((px(LM.noseL) - px(LM.noseR)) * asp, py(LM.noseL) - py(LM.noseR)) / W / 2;
    const mouthMid = mid(LM.lipTop, LM.lipBottom);
    const mouth = local(mouthMid[0], mouthMid[1]);
    const mouthW =
      Math.hypot((px(LM.mouthL) - px(LM.mouthR)) * asp, py(LM.mouthL) - py(LM.mouthR)) / W;
    const forehead = local(px(LM.forehead), py(LM.forehead));
    return {
      mouth: [mouth[0], mouth[1], Math.max(0.15, mouthW * 0.85)],
      forehead,
      center: [cx, cy],
      axis: ax,
      width: W,
      eyeY: (eyeLocalL[1] + eyeLocalR[1]) / 2,
      chin,
      eyeL: [eyeLocalL[0], eyeLocalL[1], eyeRad],
      eyeR: [eyeLocalR[0], eyeLocalR[1], eyeRad],
      nose: [nose[0], nose[1], Math.max(0.08, noseHalf), 0.28],
    };
  }

  function createMask() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  /*
   * Paints lipstick, blush and eyeshadow into the mask canvas. The canvas keeps
   * the source aspect ratio, so landmark coordinates map straight onto it.
   * makeup: { lip, blush, shadow: hex or "", amount: 0..1 }
   * Returns false when there is nothing to paint.
   */
  function drawMakeup(mask, pts, asp, makeup) {
    const { canvas, ctx } = mask;
    const w = MASK_WIDTH;
    const h = Math.max(64, Math.round(w / asp));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, w, h);
    if (!pts || (!makeup.lip && !makeup.blush && !makeup.shadow && !(makeup.contour > 0.01))) return false;

    const X = (i) => pts[i * 2] * w;
    const Y = (i) => pts[i * 2 + 1] * h;
    const amount = Math.min(1, Math.max(0, makeup.amount));
    const faceW = Math.hypot(X(LM.faceRight) - X(LM.faceLeft), Y(LM.faceRight) - Y(LM.faceLeft));
    const ux = (X(LM.faceRight) - X(LM.faceLeft)) / faceW;
    const uy = (Y(LM.faceRight) - Y(LM.faceLeft)) / faceW;
    const up = [uy, -ux];

    if (makeup.contour > 0.01) {
      [
        [LM.faceLeft, LM.cheekL, LM.mouthL],
        [LM.faceRight, LM.cheekR, LM.mouthR],
      ].forEach(([ear, cheek, mouth]) => {
        const sx = X(ear) + (X(cheek) - X(ear)) * 0.6;
        const sy = Y(ear) + (Y(cheek) - Y(ear)) * 0.6;
        const ex = X(cheek) + (X(mouth) - X(cheek)) * 0.4;
        const ey = Y(cheek) + (Y(mouth) - Y(cheek)) * 0.4;
        const len = Math.hypot(ex - sx, ey - sy) * 0.62;
        const rot = Math.atan2(ey - sy, ex - sx);
        const c = Math.min(1, makeup.contour);
        ctx.save();
        ctx.translate((sx + ex) / 2, (sy + ey) / 2);
        ctx.rotate(rot);
        ctx.scale(1, (faceW * 0.075) / len);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
        g.addColorStop(0, rgba("#7a5648", 0.4 * c));
        g.addColorStop(0.5, rgba("#7a5648", 0.2 * c));
        g.addColorStop(1, rgba("#7a5648", 0));
        ctx.fillStyle = g;
        ctx.fillRect(-len, -len, len * 2, len * 2);
        ctx.restore();
      });
    }

    if (makeup.blush) {
      [
        [LM.cheekL, LM.faceLeft],
        [LM.cheekR, LM.faceRight],
      ].forEach(([cheek, edge]) => {
        const cxp = X(cheek) + (X(edge) - X(cheek)) * 0.28 + up[0] * faceW * 0.02;
        const cyp = Y(cheek) + (Y(edge) - Y(cheek)) * 0.28 + up[1] * faceW * 0.02;
        const r = faceW * 0.2;
        const g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, r);
        g.addColorStop(0, rgba(makeup.blush, 0.6 * amount));
        g.addColorStop(0.5, rgba(makeup.blush, 0.3 * amount));
        g.addColorStop(1, rgba(makeup.blush, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cxp - r, cyp - r, r * 2, r * 2);
      });
    }

    if (makeup.shadow) {
      [LID_L, LID_R].forEach((lid) => {
        const eyeW = Math.hypot(X(lid[0]) - X(lid[8]), Y(lid[0]) - Y(lid[8]));
        const lift = eyeW * 0.55;
        ctx.beginPath();
        lid.forEach((i, k) => {
          const x = X(i);
          const y = Y(i);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let k = lid.length - 1; k >= 0; k--) {
          const t = Math.sin((k / (lid.length - 1)) * Math.PI);
          ctx.lineTo(X(lid[k]) + up[0] * lift * (0.35 + 0.65 * t), Y(lid[k]) + up[1] * lift * (0.35 + 0.65 * t));
        }
        ctx.closePath();
        ctx.shadowColor = rgba(makeup.shadow, 0.7 * amount);
        ctx.shadowBlur = Math.max(3, eyeW * 0.5);
        ctx.fillStyle = rgba(makeup.shadow, 0.45 * amount);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    if (makeup.lip) {
      const path = (list) => {
        ctx.beginPath();
        list.forEach((i, k) => {
          if (k === 0) ctx.moveTo(X(i), Y(i));
          else ctx.lineTo(X(i), Y(i));
        });
        ctx.closePath();
      };
      path(LIPS_OUTER);
      ctx.shadowColor = rgba(makeup.lip, 0.6 * amount);
      ctx.shadowBlur = Math.max(2, faceW * 0.018);
      ctx.fillStyle = rgba(makeup.lip, 0.75 * amount);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "destination-out";
      path(LIPS_INNER);
      ctx.fillStyle = "rgba(0,0,0,0.96)";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    return true;
  }


  /*
   * Effect mask (opaque): R = teeth whitening, G = under-eye brightening,
   * B = highlight (nose bridge and cheekbones). Strengths are baked in.
   * skin: { teeth, dark, highlight } each 0..1. Returns false if all are off.
   */
  function drawFx(mask, pts, asp, skin) {
    const { canvas, ctx } = mask;
    const w = MASK_WIDTH;
    const h = Math.max(64, Math.round(w / asp));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const on = (v) => v > 0.01;
    if (!pts || (!on(skin.teeth) && !on(skin.dark) && !on(skin.highlight))) return false;

    const X = (i) => pts[i * 2] * w;
    const Y = (i) => pts[i * 2 + 1] * h;
    const faceW = Math.hypot(X(LM.faceRight) - X(LM.faceLeft), Y(LM.faceRight) - Y(LM.faceLeft));
    const angle = Math.atan2(Y(LM.faceRight) - Y(LM.faceLeft), X(LM.faceRight) - X(LM.faceLeft));
    ctx.globalCompositeOperation = "lighter";

    const spot = (cx, cy, rx, ry, channel, strength) => {
      const c = [0, 0, 0];
      c[channel] = 255;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${strength})`);
      g.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${strength * 0.5})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    };

    if (on(skin.dark)) {
      [
        [LM.lowerLidL, LM.eyeLOuter, LM.eyeLInner],
        [LM.lowerLidR, LM.eyeROuter, LM.eyeRInner],
      ].forEach(([lid, a, b]) => {
        const eyeW = Math.hypot(X(a) - X(b), Y(a) - Y(b));
        spot(X(lid), Y(lid) + eyeW * 0.28, eyeW * 0.75, eyeW * 0.4, 1, skin.dark);
      });
    }

    if (on(skin.highlight)) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = faceW * 0.05;
      ctx.strokeStyle = `rgba(0,0,255,${0.7 * skin.highlight})`;
      ctx.shadowColor = `rgba(0,0,255,${skin.highlight})`;
      ctx.shadowBlur = faceW * 0.04;
      ctx.beginPath();
      [LM.bridge, 6, 197, 195].forEach((i, k) => {
        if (k === 0) ctx.moveTo(X(i), Y(i));
        else ctx.lineTo(X(i), Y(i));
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      [
        [LM.cheekL, LM.eyeLOuter],
        [LM.cheekR, LM.eyeROuter],
      ].forEach(([cheek, eye]) => {
        const cx = X(cheek) + (X(eye) - X(cheek)) * 0.5;
        const cy = Y(cheek) + (Y(eye) - Y(cheek)) * 0.5;
        spot(cx, cy, faceW * 0.14, faceW * 0.08, 2, 0.75 * skin.highlight);
      });
    }

    if (on(skin.teeth)) {
      let mx = 0;
      let my = 0;
      LIPS_INNER.forEach((i) => {
        mx += X(i);
        my += Y(i);
      });
      mx /= LIPS_INNER.length;
      my /= LIPS_INNER.length;
      ctx.beginPath();
      LIPS_INNER.forEach((i, k) => {
        const x = mx + (X(i) - mx) * 0.9;
        const y = my + (Y(i) - my) * 0.9;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = `rgba(255,0,0,${skin.teeth})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    return true;
  }

  window.ThaiSuayFace = { load, setMode, detectVideo, detectImage, createTracker, geometry, createMask, drawMakeup, drawFx };
})();
