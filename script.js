// 🌍 Advanced raster viewer with custom coloring and sidebar controls
console.log("✅ Advanced GeoTIFF viewer initializing");

// 🔄 Dynamic layer management
function checkForNewLayers() {
  // Check if there's a new layer from the analysis
  const newLayerData = localStorage.getItem('newSuitabilityLayer');
  
  if (newLayerData) {
    try {
      const layerInfo = JSON.parse(newLayerData);
      
      // Add the new layer to RASTERS if not already present
      const existingLayer = RASTERS.find(r => r.file === `../data/${layerInfo.filename}`);
      
      if (!existingLayer) {
        console.log(`Adding new suitability layer: ${layerInfo.display_name}`);
        
        // Create new layer object
        const newLayer = {
          key: `Suitability_${layerInfo.layer_name}`,
          name: layerInfo.display_name,
          file: `../data/${layerInfo.filename}`,
          type: 'suitability',
          isCustom: true,
          created: layerInfo.created
        };
        
        // Add to RASTERS array
        RASTERS.push(newLayer);
        
        // Add to METRIC_DESCRIPTIONS
        METRIC_DESCRIPTIONS[newLayer.key] = {
          title: `🎯 ${layerInfo.display_name}`,
          text: `Custom suitability analysis based on your selected environmental factor weights. This layer reflects your specific criteria for agricultural land evaluation.`
        };
        
        // Refresh the sidebar to include the new layer
        if (typeof updateSidebar === 'function') {
          updateSidebar();
        }
        
        // Clear the localStorage entry
        localStorage.removeItem('newSuitabilityLayer');
        
        // Optionally load the new layer automatically
        setTimeout(() => {
          if (confirm(`New layer "${layerInfo.display_name}" is available! Would you like to load it now?`)) {
            loadRaster(newLayer.key);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing new layer:', error);
      localStorage.removeItem('newSuitabilityLayer');
    }
  }
}

// 🏙️ Suitability coloring - land use zones with specific value mappings
function suitabilityColor(v, min, max) {
  if (v == null || isNaN(v)) return null;
  if (max === min) return [128, 128, 128];
  
  // Check for specific values first
  const tol = 1e-6;
  if (Math.abs(v - 0.1) < tol) return [255, 0, 0];     // red for 0.1
  if (Math.abs(v - 0.2) < tol) return [128, 128, 128]; // gray for 0.2
  
  // For other values, use gradient from yellow to green
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t));
  
  return interpolateColor([
    { t: 0, color: [255, 255, 0] },    // yellow (zone for buildings)
    { t: 1, color: [0, 100, 0] }       // dark green (agricultural zone)
  ], t);
}

// 🌈 Generic coloring - distinctive violet to salmon gradient
function genericColor(v, min, max) {
  if (v == null || isNaN(v)) return null;
  if (max === min) return [128, 128, 128];
  
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t));
  
  return interpolateColor([
    { t: 0, color: [138, 43, 226] },   // blue violet (low)
    { t: 0.33, color: [75, 0, 130] },  // indigo (low-med)
    { t: 0.66, color: [255, 105, 180] }, // hot pink (med-high)
    { t: 1, color: [250, 128, 114] }   // salmon (high)
  ], t);
}

// 📊 Raster configuration - matching your actual data files
const RASTERS = [
  { key: 'SoilMoisture', name: 'Soil Moisture', file: '../data/SoilMoisture.tif', type: 'moisture', logo: '../images/Soil Moisture Logo.png' },
  { key: 'PH', name: 'Soil pH', file: '../data/PH.tif', type: 'ph', logo: '../images/pH logo.png' },
  { key: 'SoilTexture', name: 'Soil Texture', file: '../data/SoilTexture.tif', type: 'generic', logo: '../images/Soil Texture Logo.png' },
  { key: 'Fertility', name: 'Fertility', file: '../data/Fertility.tif', type: 'fertility', logo: '../images/Fertility Logo.png' },
  { key: 'Nitrogen', name: 'Nitrogen', file: '../data/Nitrogen.tif', type: 'nutrient', logo: '../images/Nitrogen Logo.png' },
  { key: 'Phosphorus', name: 'Phosphorus', file: '../data/Phosphorus.tif', type: 'nutrient', logo: '../images/Phosphorus Logo.png' },
  { key: 'Potassium', name: 'Potassium', file: '../data/Potassium.tif', type: 'nutrient', logo: '../images/Potassium Logo.png' },
  { key: 'Sulphur', name: 'Sulphur', file: '../data/Sulphur.tif', type: 'nutrient', logo: '../images/Sulfur Logo.png' },
  { key: 'SOC', name: 'Soil Organic Carbon', file: '../data/SOC.tif', type: 'generic', logo: '../images/SOC logo.png' },
  { key: 'NDVI', name: 'NDVI', file: '../data/NDVI.tif', type: 'ndvi', logo: '../images/NDVI Logo.png' },
  { key: 'Suitability', name: 'Suitability', file: '../data/Suitability.tif', type: 'suitability', logo: '../images/Suitability Logo.png' },
  { key: 'Suitability2', name: 'Suitability 2', file: '../data/Suitability2.tif', type: 'suitability' },
  { key: 'PM25', name: 'PM2.5 Air Quality', file: '../data/PM25.tif', type: 'generic', logo: '../images/PM2.5 logo.png' },
  { key: 'Precipitation', name: 'Precipitation + NDVI', file: '../data/Precipitation.tif', type: 'ndvi', logo: '../images/Precipitation x NVDI logo.png' }
];

// 🧾 Metric Descriptions
const METRIC_DESCRIPTIONS = {
  SOC: {
    title: "SOC (Soil Organic Carbon)",
    text: "Indicates the amount of carbon stored in soil organic matter higher SOC means healthier, more fertile soil and better crop productivity."
  },
  NDVI: {
    title: "NDVI (Normalized Difference Vegetation Index)",
    text: "Measures how green and dense vegetation is using satellite data higher NDVI means stronger, healthier plant growth."
  },
  Fertility: {
    title: "🌾 Soil Fertility",
    text: "Represents the soil’s ability to supply essential nutrients to plants fertile soils support high crop yields."
  },
  Nitrogen: {
    title: "Nitrogen (N)",
    text: "An essential nutrient that drives plant growth and leaf development low nitrogen limits productivity, while excess can cause pollution."
  },
  PH: {
    title: "pH (Soil Acidity/Alkalinity)",
    text: "Shows how acidic or alkaline the soil is most crops grow best in neutral pH (around 6–7)."
  },
  PM25: {
    title: "PM2.5 (Air Pollution)",
    text: "Fine particles in the air that can affect plant health, reduce photosynthesis, and harm human health."
  },
  Phosphorus: {
    title: "Phosphorus (P)",
    text: "Supports root development and early plant growth crucial for seed formation and energy transfer."
  },
  Potassium: {
    title: "Potassium (K)",
    text: "Improves drought resistance, disease tolerance, and crop quality essential for balancing plant metabolism."
  },
  Precipitation: {
    title: "Precipitation",
    text: "Total rainfall received directly influences water availability for crops and soil moisture balance."
  },
  SoilMoisture: {
    title: "Soil Moisture",
    text: "Represents the amount of water in the soil vital for plant roots and an indicator of drought or irrigation needs."
  },
  SoilTexture: {
    title: "Soil Texture",
    text: "Describes the proportion of sand, silt, and clay affects water retention, aeration, and nutrient availability."
  },
  Sulphur: {
    title: "Sulphur (S)",
    text: "A secondary nutrient that enhances protein formation and improves crop flavor and quality."
  },
  Suitability: {
    title: "🎯 Land Suitability Analysis",
    text: "Evaluates land use potential based on multiple factors including soil properties, topography, and environmental conditions. Red areas are already built-up and unavailable for development, gray areas have uncertain suitability, yellow areas are suitable for new construction, and green areas are best preserved for agricultural use."
  },
  Suitability2: {
    title: "🎯 Land Suitability Analysis 2",
    text: "Alternative suitability assessment using different weighting criteria. Provides a secondary perspective on land use potential to support comprehensive planning decisions. Red areas represent existing development, while the gradient from yellow to green indicates increasing suitability for agricultural preservation."
  }
};// 🗺️ Geographic bounds for Addis Ababa - Expanded for better exploration
const ADDIS_BOUNDS = L.latLngBounds([
  [8.5, 38.3], // southwest - expanded
  [9.4, 39.2]  // northeast - expanded
]);

const ADDIS_CENTER = [9.03, 38.74]; // Your original coordinates
const ZOOM_START = 10;
const ZOOM_MIN = 11; // Reduced minimum zoom for better overview
const ZOOM_MAX = 20;

// 🗺️ Initialize map
let map = L.map('map', {
  center: ADDIS_CENTER,
  zoom: ZOOM_START,
  maxBounds: ADDIS_BOUNDS,
  maxBoundsViscosity: 0.3, // Reduced viscosity for smoother panning
  worldCopyJump: false,
  minZoom: ZOOM_MIN,
  maxZoom: ZOOM_MAX
});

let base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: ZOOM_MAX,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 🎛️ UI Elements - Updated for new 3-column layout
let currentLayer = null;
const layerListEl = document.getElementById('layer-list');
const statusEl = document.getElementById('status');
const legendBar = document.getElementById('legend-bar');
const minValEl = document.getElementById('min-val');
const midValEl = document.getElementById('mid-val');
const maxValEl = document.getElementById('max-val');
const notesEl = document.getElementById('legend-notes');
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');

// 🎨 Color interpolation function
function interpolateColor(stops, t) {
  if (t <= stops[0].t) return stops[0].color;
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].color;
  
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.t && t <= b.t) {
      const lt = (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * lt),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * lt),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * lt)
      ];
    }
  }
  return stops[0].color;
}

// 💧 Soil moisture - yellow (dry) → green (best) → blue (wet)
function moistureColor(v) {
  if (v == null || isNaN(v)) return null;
  if (v < 1 || v > 10) return null;
  
  const t = (v - 1) / 9; // 0..1 from value 1 to 10
  return interpolateColor([
    { t: 0, color: [255, 255, 0] },     // yellow (1-dry)
    { t: 0.44, color: [0, 255, 0] },    // green (5-best/optimal)
    { t: 1, color: [0, 0, 255] }        // blue (10-wet)
  ], t);
}

// 🧪 pH special coloring - distinctive purple to cyan gradient
function phColor(v, min = 0, max = 1) {
  if (v == null || isNaN(v)) return null;
  
  // Normalize to 0-1 range based on min/max
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t)); // clamp to 0-1
  
  // Purple (worst) → Pink → Light Blue → Cyan (best)
  return interpolateColor([
    { t: 0, color: [128, 0, 128] },   // purple (worst pH)
    { t: 0.33, color: [255, 20, 147] }, // deep pink
    { t: 0.66, color: [0, 191, 255] }, // light blue  
    { t: 1, color: [0, 255, 255] }    // cyan (best pH)
  ], t);
}

// � NDVI coloring (1=built up, 3=optimal, 5=dense forest)
function ndviColor(v, min = 1, max = 5) {
  if (v == null || isNaN(v)) return null;
  
  // Normalize to 0-1 range
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t));
  
  if (t <= 0.25) {
    // 1-2 range: red → lighter red (more pure red, less pink)
    const localT = t / 0.25; // 0..1 within first 25% (values 1-2)
    return interpolateColor([
      { t: 0, color: [255, 0, 0] },     // pure red (1)
      { t: 1, color: [255, 69, 0] }     // red orange (2)
    ], localT);
  } else {
    // 2-5 range: light green → medium green → very dark green
    const localT = (t - 0.25) / 0.75; // 0..1 within remaining 75% (values 2-5)
    return interpolateColor([
      { t: 0, color: [144, 238, 144] }, // light green (3)
      { t: 0.5, color: [34, 139, 34] }, // forest green (4)
      { t: 1, color: [0, 100, 0] }      // very dark green (5)
    ], localT);
  }
}

// 🧪 Nutrient coloring - distinctive orange-amber palette (5=optimal)
function nutrientColor(v, min, max) {
  if (v == null || isNaN(v)) return null;
  if (max === min) return [128, 128, 128];
  
  // Assume 5 is optimal - calculate distance from 5
  const optimal = 5;
  const maxDistance = Math.max(Math.abs(optimal - min), Math.abs(optimal - max));
  const distance = Math.abs(v - optimal);
  const t = 1 - (distance / maxDistance); // 1 = optimal, 0 = furthest from optimal
  
  return interpolateColor([
    { t: 0, color: [139, 0, 0] },      // dark red (poor)
    { t: 0.3, color: [255, 69, 0] },   // orange red (low)
    { t: 0.7, color: [255, 165, 0] },  // orange (moderate)
    { t: 1, color: [255, 215, 0] }     // gold (optimal)
  ], t);
}

// �🌈 Generic coloring (red → yellow → green)
function genericColor(v, min, max) {
  if (v == null || isNaN(v)) return null;
  if (max === min) return [128, 128, 128];
  
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t));
  
  return interpolateColor([
    { t: 0, color: [180, 0, 0] },      // red
    { t: 0.5, color: [255, 220, 0] },  // yellow
    { t: 1, color: [0, 170, 0] }       // green
  ], t);
}

// �️ Suitability coloring - land use zones
function suitabilityColor(v, min, max) {
  if (v == null || isNaN(v)) return null;
  if (max === min) return [128, 128, 128];
  
  let t = (v - min) / (max - min);
  t = Math.max(0, Math.min(1, t));
  
  // Three distinct zones: red (built-up), yellow (building), dark green (agricultural)
  return interpolateColor([
    { t: 0, color: [255, 0, 0] },      // red (built-up areas)
    { t: 0.5, color: [255, 255, 0] },  // yellow (zone for buildings)
    { t: 1, color: [0, 100, 0] }       // dark green (agricultural zone)
  ], t);
}

// �🌱 Fertility - distinctive magenta-based palette
function fertilityColor(v) {
  if (v == null || isNaN(v)) return null;
  
  const tol = 1e-6;
  if (Math.abs(v - 0) < tol) return [34, 139, 34];    // forest green (best)
  if (Math.abs(v - 4) < tol) return [255, 165, 0];    // orange (okay)
  if (Math.abs(v - 36) < tol) return [139, 69, 19];   // saddle brown (bad)
  
  // Interpolate between known values
  if (v < 2) {
    return interpolateColor([
      { t: 0, color: [34, 139, 34] },   // forest green (best)
      { t: 1, color: [255, 165, 0] }    // orange (okay)
    ], (v / 4));
  } else if (v < 20) {
    return interpolateColor([
      { t: 0, color: [255, 165, 0] },   // orange (okay)
      { t: 1, color: [139, 69, 19] }    // saddle brown (bad)
    ], (v - 4) / (36 - 4));
  }
  return [139, 69, 19];
}

// 🎨 Draw legend on canvas
function drawLegend(type, min, max) {
  const ctx = legendBar.getContext('2d');
  const w = legendBar.width;
  const h = legendBar.height;
  const img = ctx.createImageData(w, h);

  if (type === 'moisture') {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const v = 1 + t * 9; // Map to 1-10 range
      let c = moistureColor(v);
      if (!c) c = [0, 0, 0];
      
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Dry';
    midValEl.textContent = 'Best';
    maxValEl.textContent = 'Wet';
    notesEl.textContent = 'Soil Moisture: dry → best → wet';
    
  } else if (type === 'ph') {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const v = min + t * (max - min); // Map to actual data range
      let c = phColor(v, min, max);
      if (!c) c = [0, 0, 0];
      
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Worst';
    midValEl.textContent = 'Medium';
    maxValEl.textContent = 'Best';
    notesEl.textContent = 'pH Suitability: Lower=worse, Higher=better';
    
  } else if (type === 'ndvi') {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const v = min + t * (max - min);
      let c = ndviColor(v, min, max);
      if (!c) c = [0, 0, 0];
      
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Built-up zones';
    midValEl.textContent = 'Light vegetation';
    maxValEl.textContent = 'Dense vegetation';
    notesEl.textContent = 'NDVI: Built-up zones → Light vegetation → Dense vegetation';
    
  } else if (type === 'nutrient') {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const v = min + t * (max - min);
      let c = nutrientColor(v, min, max);
      if (!c) c = [0, 0, 0];
      
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Low';
    midValEl.textContent = 'Optimal';
    maxValEl.textContent = 'High';
    notesEl.textContent = 'Nutrient Level: Optimal level best, distance from optimal worse';
    
  } else if (type === 'fertility') {
    // Draw fertility legend with discrete segments
    const segments = [
      { label: '0', color: [0, 170, 0] },
      { label: '4', color: [255, 200, 0] },
      { label: '36', color: [180, 0, 0] }
    ];
    const segWidth = Math.floor(w / segments.length);
    
    for (let i = 0; i < segments.length; i++) {
      const c = segments[i].color;
      for (let x = i * segWidth; x < (i === segments.length - 1 ? w : (i + 1) * segWidth); x++) {
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          img.data[idx] = c[0];
          img.data[idx + 1] = c[1];
          img.data[idx + 2] = c[2];
          img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = '0 (Best)';
    midValEl.textContent = '4 (OK)';
    maxValEl.textContent = '36 (Bad)';
    notesEl.textContent = 'Fertility: 0=best (green), 4=okay, 36=bad (red)';
    
  } else if (type === 'suitability') {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const v = min + t * (max - min);
      let c = suitabilityColor(v, min, max);
      if (!c) c = [0, 0, 0];
      
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Already built-up, Uncertain';
    midValEl.textContent = 'Building Zone';
    maxValEl.textContent = 'Agricultural';
    notesEl.textContent = 'Suitability: Already built-up → Uncertain → Building zones → Agricultural';
    
  } else {
    // Generic gradient legend
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const c = genericColor(min + t * (max - min), min, max);
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    minValEl.textContent = 'Bad';
    midValEl.textContent = 'OK';
    maxValEl.textContent = 'Best';
    notesEl.textContent = 'Bad → OK → Best';
  }
}

// 🔄 Activate a layer
function activateLayer(record) {
  document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('active'));
  record.itemEl.classList.add('active');

  if (currentLayer) {
    map.removeLayer(currentLayer);
  }
  currentLayer = record.layer;
  
  // Set opacity from slider
  const opacity = opacitySlider.value / 100;
  currentLayer.setOpacity(opacity);
  
  currentLayer.addTo(map);

  // Draw appropriate legend
  if (record.type === 'moisture') {
    drawLegend('moisture');
  } else if (record.type === 'ph') {
    drawLegend('ph', record.min, record.max);
  } else if (record.type === 'ndvi') {
    drawLegend('ndvi', record.min, record.max);
  } else if (record.type === 'nutrient') {
    drawLegend('nutrient', record.min, record.max);
  } else if (record.type === 'fertility') {
    drawFertilityLegend();
  } else if (record.type === 'suitability') {
    drawLegend('suitability', record.min, record.max);
  } else {
    drawLegend('generic', record.min, record.max);
  }
  // 📢 Show metric description popup if available
  const popup = document.getElementById("metric-popup");
  const titleEl = document.getElementById("popup-title");
  const textEl = document.getElementById("popup-text");

  if (METRIC_DESCRIPTIONS[record.key]) {
    const { title, text } = METRIC_DESCRIPTIONS[record.key];
    
    // Clear existing content
    titleEl.innerHTML = '';
    
    // Add logo if available
    if (record.logo) {
      const logoImg = document.createElement('img');
      logoImg.src = record.logo;
      logoImg.alt = record.name;
      logoImg.style.width = '32px';
      logoImg.style.height = '32px';
      logoImg.style.marginRight = '12px';
      logoImg.style.verticalAlign = 'middle';
      titleEl.appendChild(logoImg);
    }
    
    // Add title text
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleSpan.style.verticalAlign = 'middle';
    titleEl.appendChild(titleSpan);
    
    textEl.textContent = text;
    popup.style.display = "flex";
  }
}


// 🌱 Draw fertility legend with discrete segments
function drawFertilityLegend() {
  const ctx = legendBar.getContext('2d');
  const w = legendBar.width; 
  const h = legendBar.height;
  const img = ctx.createImageData(w, h);
  
  // Render three equal segments for 0, 4, 36 - matching fertilityColor function
  const segments = [
    { label: '0 (Best)', color: [34, 139, 34] },   // forest green (matches fertilityColor)
    { label: '4 (Okay)', color: [255, 165, 0] },   // orange (matches fertilityColor)
    { label: '36 (Bad)', color: [139, 69, 19] }    // saddle brown (matches fertilityColor)
  ];
  const segWidth = Math.floor(w / segments.length);
  
  for (let i = 0; i < segments.length; i++) {
    const c = segments[i].color;
    for (let x = i * segWidth; x < (i === segments.length - 1 ? w : (i + 1) * segWidth); x++) {
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = c[0];
        img.data[idx + 1] = c[1];
        img.data[idx + 2] = c[2];
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  minValEl.textContent = 'Best';
  midValEl.textContent = 'OK';
  maxValEl.textContent = 'Bad';
  notesEl.textContent = 'Fertility: Best → OK → Bad';
}

// 📝 Create layer list item
function createListItem(record) {
  const div = document.createElement('div');
  div.className = 'layer-item';
  
  // Create logo and text elements
  if (record.logo) {
    const img = document.createElement('img');
    img.src = record.logo;
    img.alt = record.name;
    img.style.width = '24px';
    img.style.height = '24px';
    img.style.marginRight = '8px';
    img.style.verticalAlign = 'middle';
    div.appendChild(img);
    
    const span = document.createElement('span');
    span.textContent = record.name;
    span.style.verticalAlign = 'middle';
    div.appendChild(span);
  } else {
    div.textContent = record.name;
  }
  
  div.addEventListener('click', () => activateLayer(record));
  record.itemEl = div;
  layerListEl.appendChild(div);
}

// 📥 Load raster data
function loadRaster(meta) {
  const candidates = Array.isArray(meta.file) ? meta.file : [meta.file];
  
  let lastError = null;
  function tryNext(idx) {
    if (idx >= candidates.length) {
      throw lastError || new Error('All candidate paths failed for ' + meta.name);
    }
    
    const path = candidates[idx];
    return fetch(path)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
        return r.arrayBuffer();
      })
      .then(ab => parseGeoraster(ab))
      .then(georaster => ({ georaster, path }))
      .catch(err => {
        lastError = err;
        return tryNext(idx + 1);
      });
  }

  return tryNext(0).then(({ georaster, path }) => {
    const min = georaster.mins[0];
    const max = georaster.maxs[0];
    
    const layer = new GeoRasterLayer({
      georaster,
      opacity: 0.75,
      pixelValuesToColorFn: values => {
        const v = values[0];
        if (v == null || isNaN(v)) return null;
        
        let c;
        if (meta.type === 'moisture') {
          c = moistureColor(v);
        } else if (meta.type === 'ph') {
          c = phColor(v, min, max);
        } else if (meta.type === 'ndvi') {
          c = ndviColor(v, min, max);
        } else if (meta.type === 'nutrient') {
          c = nutrientColor(v, min, max);
        } else if (meta.type === 'fertility') {
          c = fertilityColor(v);
        } else if (meta.type === 'suitability') {
          c = suitabilityColor(v, min, max);
        } else {
          c = genericColor(v, min, max);
        }
        
        if (!c) return null;
        return `rgba(${c[0]},${c[1]},${c[2]},255)`;
      }
    });
    
    return { ...meta, file: path, layer, min, max };
  });
}

// 🚀 Initialize application
(async function init() {
  statusEl.textContent = 'Loading rasters...';
  const records = [];
  
  for (let meta of RASTERS) {
    try {
      const rec = await loadRaster(meta);
      records.push(rec);
      createListItem(rec);
      statusEl.textContent = `Loaded ${records.length}/${RASTERS.length}`;
    } catch (e) {
      console.error('Failed to load', meta.file, e);
      statusEl.textContent = 'Error loading some rasters (see console).';
    }
  }
  
  if (records.length) {
    activateLayer(records[0]);
    statusEl.textContent = `✅ Ready - ${records.length} layers loaded`;
  } else {
    statusEl.textContent = '❌ No rasters loaded.';
  }
})();

// 🎚️ Opacity slider functionality
if (opacitySlider && opacityValue) {
  opacitySlider.addEventListener('input', function() {
    const opacity = this.value / 100;
    opacityValue.textContent = `${this.value}%`;
    
    if (currentLayer) {
      currentLayer.setOpacity(opacity);
    }
  });
}

// 🪟 Close popup when user clicks outside or presses ✖
const closeBtn = document.getElementById("close-popup");
const popup = document.getElementById("metric-popup");
if (closeBtn && popup) {
  closeBtn.addEventListener("click", () => popup.style.display = "none");
  popup.addEventListener("click", (e) => {
    if (e.target.id === "metric-popup") popup.style.display = "none";
  });
}