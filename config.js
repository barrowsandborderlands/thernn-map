/**
 * Thernn 1899 – Western Esteria Map Configuration
 */
const THERNN_CONFIG = {
  // ── Map Image ─────────────────────────────────────────────────
  mapImage: 'map.jpg',
  imageWidth: 5363,
  imageHeight: 3691,
  // Zoom range
  minZoom: -1,
  maxZoom: 5,
  defaultZoom: 0,
  // ── Grid System ───────────────────────────────────────────────
  // XX.YY format (2-digit). EW = 01–79, NS = 01–55.
  // Grid squares are 59.1 px each.
  // Grid pixel origin (top-left corner of square 01.01): px(303, 193)
  grid: {
    xMin: -4.63,   // left edge of image in grid coords
    xMax: 86.12,   // right edge of image in grid coords
    yMin: -2.77,   // top edge of image in grid coords
    yMax: 59.69,   // bottom edge of image in grid coords
    ewMin: 1,      // first EW grid number
    ewMax: 79,     // last EW grid number
    nsMin: 1,      // first NS grid number
    nsMax: 55,     // last NS grid number
  },
  // Default center (middle of map)
  defaultCenter: { x: 40, y: 28 },
  // ── Display ───────────────────────────────────────────────────
  mapTitle: 'Map of Thernn 1899 – Western Esteria',
  backgroundColor: '#f5f0e6',
};
window.THERNN_CONFIG = THERNN_CONFIG;
