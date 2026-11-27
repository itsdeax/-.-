/*
 * Filter definitions for ถ่ายสวย.
 *
 * To add a filter, append an object to the array below:
 *
 *   { id: "my-filter", name: "ชื่อที่แสดง", chip: ["#fff1dc", "#f0cfae"], p: { ... } }
 *
 *   id    unique, lowercase letters/digits/hyphen
 *   name  label under the swatch (keep it short)
 *   chip  two hex colours for the swatch gradient
 *   p     any of the parameters below; omitted ones use their default
 *
 * Parameters (range, default):
 *   exposure  -1 .. 1      0     brightness in stops
 *   contrast  0.6 .. 1.6   1
 *   sat       0 .. 2       1     colour saturation
 *   temp      -1 .. 1      0     negative = cooler, positive = warmer
 *   tint      -1 .. 1      0     negative = greener, positive = pinker
 *   fade      0 .. 0.3     0     lifts the blacks for a matte look
 *   vig       0 .. 1       0     dark corners
 *   grain     0 .. 0.2     0     film noise
 *   mono      0 .. 1       0     1 = black and white
 *
 * Tip: open the app with ?dev=1 to design a filter live and copy its code.
 */
window.THAISUAY_FILTERS = [
  {
    id: "clean",
    name: "คลีน",
    chip: ["#fff4ee", "#f2c9b8"],
    p: { exposure: 0.05, contrast: 1.1, sat: 1.1, temp: 0.04 },
  },
  {
    id: "milk",
    name: "มิลค์",
    chip: ["#fffafa", "#f3d4d8"],
    p: { exposure: 0.1, contrast: 1.04, sat: 0.98, temp: -0.04, tint: 0.16 },
  },
  {
    id: "glass",
    name: "กลาสสกิน",
    chip: ["#f4fbff", "#cfe3f0"],
    p: { exposure: 0.08, contrast: 1.1, sat: 1.05, temp: -0.12, tint: 0.1 },
  },
  {
    id: "blush",
    name: "บลัช",
    chip: ["#ffe4ea", "#f59bb4"],
    p: { exposure: 0.06, contrast: 1.08, sat: 1.1, temp: 0.05, tint: 0.38 },
  },
  {
    id: "sunny",
    name: "ซันนี่",
    chip: ["#fff3c4", "#ffc66b"],
    p: { exposure: 0.06, contrast: 1.1, sat: 1.15, temp: 0.26, tint: -0.02 },
  },
  {
    id: "pastel",
    name: "พาสเทล",
    chip: ["#e9e1ff", "#ffd9ec"],
    p: { exposure: 0.12, contrast: 1.02, sat: 1.1, tint: 0.1 },
  },
  {
    id: "chrome",
    name: "โครม",
    chip: ["#e2ecf6", "#8ea5bd"],
    p: { exposure: 0.02, contrast: 1.2, sat: 1.0, temp: -0.26, tint: -0.04 },
  },
  {
    id: "flash",
    name: "แฟลช",
    chip: ["#ffffff", "#c9d6ff"],
    p: { exposure: 0.1, contrast: 1.25, sat: 1.15, temp: -0.06, tint: 0.05 },
  },
  {
    id: "muted",
    name: "มินิมอล",
    chip: ["#e9e4dc", "#b9b0a3"],
    p: { exposure: 0.04, contrast: 1.12, sat: 0.8, temp: 0.05 },
  },
  {
    id: "mono",
    name: "ขาวดำ",
    chip: ["#efefef", "#2e2e2e"],
    p: { exposure: 0.03, contrast: 1.22, mono: 1 },
  },
];

/*
 * Portrait looks. Same parameters as filters, plus `port` (each 0..1) which
 * treats the skin and the background separately:
 *   glow  dewy highlights on skin     warm  rosy skin tone
 *   mute  desaturate the background   cool  cool the background
 */
window.THAISUAY_PORTRAIT = [
  {
    id: "pt-dewy",
    name: "ผิวฉ่ำ",
    chip: ["#ffe6dc", "#f3a99a"],
    p: { exposure: 0.08, contrast: 1.08, sat: 1.05, temp: 0.06 },
    port: { glow: 0.8, warm: 0.3, mute: 0.15 },
  },
  {
    id: "pt-peach",
    name: "ครีมพีช",
    chip: ["#ffe9d6", "#f6b48f"],
    p: { exposure: 0.06, contrast: 1.06, temp: 0.14, tint: 0.15 },
    port: { glow: 0.5, warm: 0.6, mute: 0.3 },
  },
  {
    id: "pt-tea",
    name: "ชานม",
    chip: ["#eddcc8", "#b88f6c"],
    p: { exposure: 0.04, contrast: 1.05, sat: 0.9, temp: 0.2, tint: 0.05 },
    port: { glow: 0.35, warm: 0.4, mute: 0.45 },
  },
  {
    id: "pt-korean",
    name: "เกาหลีใส",
    chip: ["#f4f7ff", "#d8c4ee"],
    p: { exposure: 0.12, contrast: 1.04, sat: 0.95, temp: -0.06, tint: 0.12 },
    port: { glow: 0.6, warm: 0.2, mute: 0.25, cool: 0.5 },
  },
  {
    id: "pt-glow",
    name: "ซอฟต์โกลว์",
    chip: ["#fff1f4", "#f8bfd0"],
    p: { exposure: 0.1, contrast: 1.02, sat: 1.05, tint: 0.2 },
    port: { glow: 1, warm: 0.3, mute: 0.1, cool: 0.2 },
    fx: { bloom: 0.25 },
  },
  {
    id: "pt-sun",
    name: "ซันคิส",
    chip: ["#ffd9a0", "#d98a4a"],
    p: { contrast: 1.15, sat: 1.1, temp: 0.18 },
    port: { glow: 0.5, warm: 0.5, mute: 0.2, cool: 0.3 },
  },
];

/*
 * Compact-camera looks (G7X style): slightly underexposed, strong contrast,
 * muted colour. Adds `compact: true` and `split` (small -0.15..0.15 RGB shifts)
 * to tint the shadows (`sh`) and highlights (`hi`) separately.
 */
window.THAISUAY_COMPACT = [
  {
    id: "cp-g7x",
    name: "G7X",
    compact: true,
    chip: ["#8d9498", "#2d3438"],
    p: { exposure: -0.12, contrast: 1.18, sat: 0.68, temp: -0.04, tint: -0.03, vig: 0.25, grain: 0.05 },
    split: { sh: [-0.01, 0.015, 0.02], hi: [0.02, 0.01, -0.01] },
  },
  {
    id: "cp-g12",
    name: "Canon G12",
    compact: true,
    chip: ["#b09a80", "#3b322a"],
    p: { exposure: -0.08, contrast: 1.16, sat: 0.76, temp: 0.1, vig: 0.22, grain: 0.05 },
    split: { sh: [0.01, 0.01, 0], hi: [0.03, 0.015, -0.015] },
  },
  {
    id: "cp-eos",
    name: "EOS R",
    compact: true,
    chip: ["#7f93b3", "#1d2740"],
    p: { exposure: -0.1, contrast: 1.25, sat: 0.82, temp: -0.12, tint: 0.02, vig: 0.3, grain: 0.04 },
    split: { sh: [-0.015, 0.005, 0.035], hi: [0.01, 0, -0.005] },
  },
  {
    id: "cp-ip7",
    name: "iP 7",
    compact: true,
    chip: ["#c3bfb8", "#4a4a48"],
    p: { exposure: -0.04, contrast: 1.12, sat: 0.9, temp: 0.02, vig: 0.15, grain: 0.06 },
    split: { sh: [0, 0.01, 0.015], hi: [0.015, 0.008, 0] },
  },
  {
    id: "cp-x5",
    name: "X5",
    compact: true,
    chip: ["#7fa095", "#1f3a33"],
    p: { exposure: -0.1, contrast: 1.18, sat: 0.7, temp: -0.06, tint: -0.1, vig: 0.25, grain: 0.06 },
    split: { sh: [-0.02, 0.025, 0.02], hi: [0.02, 0.015, -0.01] },
  },
  {
    id: "cp-gr",
    name: "GR",
    compact: true,
    chip: ["#a8a8a4", "#1c1c1c"],
    p: { exposure: -0.06, contrast: 1.35, sat: 0.6, vig: 0.35, grain: 0.1 },
    split: { sh: [-0.01, 0, 0.015], hi: [0.02, 0.015, 0] },
  },
];

/*
 * Camera looks (Dazz-style). Same parameters as the filters above, plus:
 *   model  small label shown in the viewfinder
 *   fx     { bloom, leak, aber } each 0..1: highlight glow, light leak, colour fringing
 *   stamp  true = orange date stamp in the corner
 *   frame  "polaroid" = white instant-photo border
 */
window.THAISUAY_CAMERAS = [
  {
    id: "cam-ccd",
    name: "ดิจิแคม",
    model: "CCD 2003",
    chip: ["#cfe0ff", "#7fa0e0"],
    p: { exposure: 0.15, contrast: 1.18, sat: 1.12, temp: -0.12, tint: 0.1, fade: 0.015 },
    fx: { bloom: 0.22, aber: 0.25 },
    stamp: true,
  },
  {
    id: "cam-classic",
    name: "คลาสสิก",
    model: "D-CLASSIC",
    chip: ["#ffe2b0", "#d98b4a"],
    p: { exposure: 0.05, contrast: 1.1, sat: 1.05, temp: 0.22, tint: -0.05, fade: 0.02, vig: 0.2, grain: 0.04 },
    fx: { bloom: 0.12 },
    stamp: true,
  },
  {
    id: "cam-fun",
    name: "ใช้แล้วทิ้ง",
    model: "FUN-Q",
    chip: ["#ffd29a", "#e0603a"],
    p: { exposure: 0.12, contrast: 1.1, sat: 1.1, temp: 0.3, tint: 0.05, fade: 0.025, vig: 0.35, grain: 0.09 },
    fx: { leak: 0.55, bloom: 0.06 },
    stamp: true,
  },
  {
    id: "cam-instant",
    name: "อินสแตนท์",
    model: "INSTANT",
    chip: ["#fff7ea", "#e8c9b0"],
    p: { exposure: 0.1, contrast: 1.05, sat: 1.0, temp: 0.12, tint: 0.1, fade: 0.03, vig: 0.15, grain: 0.03 },
    fx: { bloom: 0.1 },
    frame: "polaroid",
  },
  {
    id: "cam-film",
    name: "ฟิล์ม 35",
    model: "35MM",
    chip: ["#c9b79a", "#6f5a46"],
    p: { contrast: 1.15, sat: 0.9, temp: 0.1, tint: -0.08, fade: 0.03, vig: 0.3, grain: 0.1 },
    fx: { bloom: 0.16, leak: 0.15 },
  },
  {
    id: "cam-flash",
    name: "แฟลชปาร์ตี้",
    model: "FLASH",
    chip: ["#ffffff", "#9fb4ff"],
    p: { exposure: 0.3, contrast: 1.25, sat: 1.05, temp: -0.1, vig: 0.25 },
    fx: { bloom: 0.25, aber: 0.3 },
    stamp: true,
  },
  {
    id: "cam-bw",
    name: "ขาวดำฟิล์ม",
    model: "B&W 400",
    chip: ["#e6e6e6", "#262626"],
    p: { contrast: 1.25, mono: 1, fade: 0.025, vig: 0.3, grain: 0.12 },
    fx: { bloom: 0.1 },
  },
];
