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
    id: "natural",
    name: "ธรรมชาติ",
    chip: ["#f3e3d6", "#d9b9a4"],
    p: {},
  },
  {
    id: "cream",
    name: "ครีมนุ่ม",
    chip: ["#fff1dc", "#f0cfae"],
    p: { exposure: 0.14, contrast: 0.92, sat: 0.9, temp: 0.25, tint: 0.08, fade: 0.06 },
  },
  {
    id: "peach",
    name: "พีช",
    chip: ["#ffd9c2", "#ff9d8a"],
    p: { exposure: 0.1, contrast: 0.96, sat: 1.06, temp: 0.35, tint: 0.28, fade: 0.05, vig: 0.15 },
  },
  {
    id: "rose",
    name: "โรส",
    chip: ["#ffd0dc", "#e8688c"],
    p: { exposure: 0.08, contrast: 1.0, sat: 1.12, temp: 0.08, tint: 0.5, fade: 0.04 },
  },
  {
    id: "clear",
    name: "ใสปิ๊ง",
    chip: ["#e3f3ff", "#9ed0f5"],
    p: { exposure: 0.22, contrast: 1.05, sat: 1.16, temp: -0.15 },
  },
  {
    id: "film",
    name: "ฟิล์ม",
    chip: ["#c9b79a", "#6f5a46"],
    p: { contrast: 1.12, sat: 0.84, temp: 0.2, tint: -0.1, fade: 0.1, vig: 0.38, grain: 0.06 },
  },
  {
    id: "golden",
    name: "โกลเด้น",
    chip: ["#ffe29a", "#f0a43c"],
    p: { exposure: 0.1, contrast: 1.05, sat: 1.12, temp: 0.65, tint: 0.1, fade: 0.03, vig: 0.25 },
  },
  {
    id: "cool",
    name: "ฟ้าเย็น",
    chip: ["#cfe3ff", "#6c8fd1"],
    p: { exposure: 0.05, contrast: 1.06, sat: 0.95, temp: -0.55, tint: -0.1, fade: 0.04 },
  },
  {
    id: "mono",
    name: "ขาวดำ",
    chip: ["#e8e8e8", "#3a3a3a"],
    p: { contrast: 1.2, mono: 1, fade: 0.04, vig: 0.3, grain: 0.05 },
  },
];
