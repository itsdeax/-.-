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
    p: { exposure: 0.08, contrast: 1.05, sat: 1.04, temp: 0.04 },
  },
  {
    id: "milk",
    name: "มิลค์",
    chip: ["#fffafa", "#f3d4d8"],
    p: { exposure: 0.22, contrast: 0.9, sat: 0.86, temp: -0.05, tint: 0.18, fade: 0.035 },
  },
  {
    id: "glass",
    name: "กลาสสกิน",
    chip: ["#f4fbff", "#cfe3f0"],
    p: { exposure: 0.2, contrast: 1.0, sat: 0.95, temp: -0.12, tint: 0.12 },
  },
  {
    id: "blush",
    name: "บลัช",
    chip: ["#ffe4ea", "#f59bb4"],
    p: { exposure: 0.12, contrast: 1.0, sat: 1.05, temp: 0.05, tint: 0.4 },
  },
  {
    id: "sunny",
    name: "ซันนี่",
    chip: ["#fff3c4", "#ffc66b"],
    p: { exposure: 0.14, contrast: 1.06, sat: 1.12, temp: 0.28, tint: -0.02 },
  },
  {
    id: "pastel",
    name: "พาสเทล",
    chip: ["#e9e1ff", "#ffd9ec"],
    p: { exposure: 0.25, contrast: 0.85, sat: 1.12, tint: 0.1, fade: 0.03 },
  },
  {
    id: "chrome",
    name: "โครม",
    chip: ["#e2ecf6", "#8ea5bd"],
    p: { exposure: 0.04, contrast: 1.14, sat: 0.9, temp: -0.3, tint: -0.04 },
  },
  {
    id: "flash",
    name: "แฟลช",
    chip: ["#ffffff", "#c9d6ff"],
    p: { exposure: 0.18, contrast: 1.2, sat: 1.1, temp: -0.08, tint: 0.05 },
  },
  {
    id: "muted",
    name: "มินิมอล",
    chip: ["#e9e4dc", "#b9b0a3"],
    p: { exposure: 0.06, contrast: 1.04, sat: 0.72, temp: 0.05 },
  },
  {
    id: "mono",
    name: "ขาวดำ",
    chip: ["#efefef", "#2e2e2e"],
    p: { exposure: 0.05, contrast: 1.15, mono: 1 },
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
    p: { exposure: 0.15, contrast: 1.18, sat: 1.12, temp: -0.12, tint: 0.1, fade: 0.03 },
    fx: { bloom: 0.35, aber: 0.25 },
    stamp: true,
  },
  {
    id: "cam-classic",
    name: "คลาสสิก",
    model: "D-CLASSIC",
    chip: ["#ffe2b0", "#d98b4a"],
    p: { exposure: 0.05, contrast: 1.1, sat: 1.05, temp: 0.22, tint: -0.05, fade: 0.05, vig: 0.2, grain: 0.04 },
    fx: { bloom: 0.2 },
    stamp: true,
  },
  {
    id: "cam-fun",
    name: "ใช้แล้วทิ้ง",
    model: "FUN-Q",
    chip: ["#ffd29a", "#e0603a"],
    p: { exposure: 0.12, contrast: 1.1, sat: 1.1, temp: 0.3, tint: 0.05, fade: 0.06, vig: 0.35, grain: 0.09 },
    fx: { leak: 0.55, bloom: 0.1 },
    stamp: true,
  },
  {
    id: "cam-instant",
    name: "อินสแตนท์",
    model: "INSTANT",
    chip: ["#fff7ea", "#e8c9b0"],
    p: { exposure: 0.18, contrast: 0.95, sat: 0.95, temp: 0.12, tint: 0.1, fade: 0.09, vig: 0.15, grain: 0.03 },
    fx: { bloom: 0.15 },
    frame: "polaroid",
  },
  {
    id: "cam-film",
    name: "ฟิล์ม 35",
    model: "35MM",
    chip: ["#c9b79a", "#6f5a46"],
    p: { contrast: 1.15, sat: 0.9, temp: 0.1, tint: -0.08, fade: 0.08, vig: 0.3, grain: 0.1 },
    fx: { bloom: 0.25, leak: 0.15 },
  },
  {
    id: "cam-flash",
    name: "แฟลชปาร์ตี้",
    model: "FLASH",
    chip: ["#ffffff", "#9fb4ff"],
    p: { exposure: 0.3, contrast: 1.25, sat: 1.05, temp: -0.1, vig: 0.25 },
    fx: { bloom: 0.4, aber: 0.3 },
    stamp: true,
  },
  {
    id: "cam-bw",
    name: "ขาวดำฟิล์ม",
    model: "B&W 400",
    chip: ["#e6e6e6", "#262626"],
    p: { contrast: 1.25, mono: 1, fade: 0.06, vig: 0.3, grain: 0.12 },
    fx: { bloom: 0.15 },
  },
];
