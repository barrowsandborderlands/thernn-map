/**
 * Thernn 1899 Interactive Map – Western Esteria
 * Single-image overlay + grid + CSV locations + sidebar + regions
 */
(function () {
  'use strict';
  const C = THERNN_CONFIG;

  // ── Coordinate Helpers ──────────────────────────────────────

  function gridToPixel(gx, gy) {
    const px = ((gx - C.grid.xMin) / (C.grid.xMax - C.grid.xMin)) * C.imageWidth;
    const py = ((gy - C.grid.yMin) / (C.grid.yMax - C.grid.yMin)) * C.imageHeight;
    return [px, py];
  }

  function pixelToGrid(px, py) {
    const gx = C.grid.xMin + (px / C.imageWidth) * (C.grid.xMax - C.grid.xMin);
    const gy = C.grid.yMin + (py / C.imageHeight) * (C.grid.yMax - C.grid.yMin);
    return [gx, gy];
  }

  // Format as XX.YY (2-digit, zero-padded)
  function formatGrid(gx, gy) {
    const ew = Math.round(gx);
    const ns = Math.round(gy);
    const ewStr = String(Math.max(0, ew)).padStart(2, '0');
    const nsStr = String(Math.max(0, ns)).padStart(2, '0');
    return `${ewStr}.${nsStr}`;
  }

  function pxToLatLng(px, py) { return L.latLng(-py, px); }

  // ── Map Setup ───────────────────────────────────────────────

  const bounds = L.latLngBounds(
    L.latLng(-C.imageHeight, 0),
    L.latLng(0, C.imageWidth)
  );

  const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: C.minZoom,
    maxZoom: C.maxZoom,
    maxBounds: bounds.pad(0.15),
    maxBoundsViscosity: 0.8,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    attributionControl: false,
  });

  const [cx, cy] = gridToPixel(C.defaultCenter.x, C.defaultCenter.y);
  map.setView(pxToLatLng(cx, cy), C.defaultZoom);

  L.imageOverlay(C.mapImage, bounds).addTo(map);

  // ── Sidebar Toggle ──────────────────────────────────────────

  const sidebarEl = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggle');

  sidebarToggleBtn.addEventListener('click', function () {
    sidebarEl.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-open');
    setTimeout(() => map.invalidateSize(), 350);
  });

  // ── Grid Number Overlay ───────────────────────────────────

  const gridLayer = L.layerGroup();
  let gridVisible = false;

  function getGridFontSize(zoom) {
    return Math.max(10, Math.round(14 + (zoom) * 3.5));
  }

  function updateGridLabels() {
    gridLayer.clearLayers();
    const zoom = map.getZoom();
    const b = map.getBounds();
    const fontSize = getGridFontSize(zoom);

    const [gxNW, gyNW] = pixelToGrid(Math.max(0, b.getWest()), Math.max(0, -b.getNorth()));
    const [gxSE, gySE] = pixelToGrid(Math.min(C.imageWidth, b.getEast()), Math.min(C.imageHeight, -b.getSouth()));

    const ewStart = Math.floor(Math.min(gxNW, gxSE));
    const ewEnd   = Math.ceil(Math.max(gxNW, gxSE));
    const nsStart = Math.floor(Math.min(gyNW, gySE));
    const nsEnd   = Math.ceil(Math.max(gyNW, gySE));

    let step = 1;
    if (zoom < -0.5) step = 10;
    else if (zoom < 0.5) step = 5;
    else if (zoom < 1.5) step = 2;

    const iconW = Math.round(fontSize * 5);
    const iconH = Math.round(fontSize * 1.6);

    for (let ew = Math.floor(ewStart / step) * step; ew <= ewEnd; ew += step) {
      if (ew < C.grid.ewMin || ew > C.grid.ewMax) continue;
      for (let ns = Math.floor(nsStart / step) * step; ns <= nsEnd; ns += step) {
        if (ns < C.grid.nsMin || ns > C.grid.nsMax) continue;
        const [px, py] = gridToPixel(ew, ns);
        const icon = L.divIcon({
          className: 'grid-label',
          html: `<span style="font-size:${fontSize}px;line-height:${iconH}px">${formatGrid(ew, ns)}</span>`,
          iconSize: [iconW, iconH],
          iconAnchor: [iconW / 2, iconH / 2],
        });
        L.marker(pxToLatLng(px, py), { icon, interactive: false }).addTo(gridLayer);
      }
    }
  }

  document.getElementById('gridToggle').addEventListener('click', function () {
    if (gridVisible) {
      map.removeLayer(gridLayer);
      map.off('moveend', updateGridLabels);
      gridVisible = false;
      this.textContent = 'Grid: OFF';
      this.classList.remove('active');
    } else {
      gridLayer.addTo(map);
      updateGridLabels();
      map.on('moveend', updateGridLabels);
      gridVisible = true;
      this.textContent = 'Grid: ON';
      this.classList.add('active');
    }
  });

  // ── Travel Mode Flag ──────────────────────────────────────

  let travelMode = false;

  // ── Coordinate Display ────────────────────────────────────

  const coordDisplay = document.getElementById('coordDisplay');

  map.on('mousemove', function (e) {
    const px = e.latlng.lng;
    const py = -e.latlng.lat;
    if (px >= 0 && px <= C.imageWidth && py >= 0 && py <= C.imageHeight) {
      const [gx, gy] = pixelToGrid(px, py);
      const ew = Math.round(gx);
      const ns = Math.round(gy);
      if (ew >= C.grid.ewMin && ew <= C.grid.ewMax && ns >= C.grid.nsMin && ns <= C.grid.nsMax) {
        coordDisplay.textContent = `Square: ${formatGrid(gx, gy)}`;
        coordDisplay.style.opacity = '1';
      } else {
        coordDisplay.style.opacity = '0.3';
        coordDisplay.textContent = 'Square: ---';
      }
    } else {
      coordDisplay.style.opacity = '0.3';
      coordDisplay.textContent = 'Square: ---';
    }
  });

  map.on('mouseout', function () {
    coordDisplay.textContent = 'Square: ---';
    coordDisplay.style.opacity = '0.3';
  });

  map.on('click', function (e) {
    if (e.originalEvent._travelHandled) return;
    if (e.originalEvent._drawHandled) return;
    if (travelMode) return;

    const px = e.latlng.lng;
    const py = -e.latlng.lat;
    if (px >= 0 && px <= C.imageWidth && py >= 0 && py <= C.imageHeight) {
      const [gx, gy] = pixelToGrid(px, py);
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<div class="grid-ref" style="font-size:15px;">Square: ${formatGrid(gx, gy)}</div>`)
        .openOn(map);
    }
  });

  // ── Icon Mapping & Colors ─────────────────────────────────

  const ICON_MAP = {
    location:       'icons/position-marker.svg',
    portal:         'icons/star-gate.svg',
    castle_or_fort: 'icons/castle.svg',
    city:           'icons/village.svg',
    dungeon:        'icons/dungeon-gate.svg',
    player_owned:   'icons/player-owned.svg',
  };
  const DEFAULT_ICON = 'icons/position-marker.svg';

  const TYPE_META = {
    city:           { label: 'Cities',          color: '#20B2AA' },
    location:       { label: 'Locations',       color: '#E03030' },
    dungeon:        { label: 'Dungeons',        color: '#FF6347' },
    portal:         { label: 'Portals',         color: '#9B30FF' },
    castle_or_fort: { label: 'Castles & Forts', color: '#FFB800' },
    player_owned:   { label: 'Player Owned',    color: '#44cc44' },
  };

  function getTypeMeta(type) {
    const key = type.toLowerCase().replace(/\s+/g, '_');
    return TYPE_META[key] || { label: type, color: '#c8b888' };
  }

  function normalizeType(type) {
    return (type || 'location').toLowerCase().replace(/\s+/g, '_');
  }

  // ── Type Visibility State ─────────────────────────────────

  const hiddenTypes = new Set();

  function isTypeVisible(type) {
    return !hiddenTypes.has(normalizeType(type));
  }

  // ── Marker Size & Creation ────────────────────────────────

  function getMarkerSize(zoom) {
    return Math.max(24, Math.round(28 + (zoom) * 5));
  }

  function makeIcon(type, size) {
    const key = normalizeType(type);
    const url = ICON_MAP[key] || DEFAULT_ICON;
    const s = size || 28;
    return L.icon({
      iconUrl: url,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      popupAnchor: [0, -(s / 2 + 4)],
      className: 'map-marker-icon',
    });
  }

  // ── Data Loading (CSV only) ───────────────────────────────

  let locations = [];
  let markers = [];

  function loadLocations() {
    return new Promise((resolve, reject) => {
      Papa.parse('data/locations.csv', {
        download: true, header: true, skipEmptyLines: true,
        complete: function (results) {
          locations = results.data.map(processRow).filter(Boolean);
          console.log(`Loaded ${locations.length} locations from CSV`);
          resolve(locations);
        },
        error: reject,
      });
    });
  }

  function processRow(row) {
    let gridX, gridY;
    if (row.square) {
      const parts = row.square.toString().trim();
      const match = parts.match(/^(\d+)\.(\d+)$/);
      if (match) {
        gridX = parseInt(match[1], 10);
        gridY = parseInt(match[2], 10);
      } else {
        return null;
      }
    } else {
      return null;
    }
    if (isNaN(gridX) || isNaN(gridY)) return null;

    const visible = row.visible !== undefined
      ? String(row.visible).toLowerCase() !== 'false'
      : true;

    return {
      gridX, gridY,
      name: row.name || '',
      type: (row.type || 'location').trim(),
      description: row.description || '',
      color: row.color || '#c8b888',
      visible,
    };
  }

  // ── Markers ───────────────────────────────────────────────

  function createMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const size = getMarkerSize(map.getZoom());

    locations.forEach(loc => {
      if (!loc.visible) return;
      const [px, py] = gridToPixel(loc.gridX, loc.gridY);
      const icon = makeIcon(loc.type, size);
      const marker = L.marker(pxToLatLng(px, py), { icon, interactive: true });

      const popupHtml = `
        <h3>${loc.name || 'Location'}</h3>
        <div class="grid-ref">Square: ${formatGrid(loc.gridX, loc.gridY)}</div>
        ${loc.type ? `<div style="color:#888;font-size:12px;margin-top:2px;">${loc.type}</div>` : ''}
        ${loc.description ? `<div class="description">${loc.description}</div>` : ''}
      `;
      marker.bindPopup(popupHtml, { maxWidth: 350 });

      if (isTypeVisible(loc.type)) {
        marker.addTo(map);
      }
      markers.push(marker);
      marker._locationData = loc;
    });
  }

  function updateMarkerSizes() {
    const size = getMarkerSize(map.getZoom());
    markers.forEach(m => {
      const loc = m._locationData;
      if (loc) m.setIcon(makeIcon(loc.type, size));
    });
  }
  map.on('zoomend', updateMarkerSizes);

  function refreshTypeVisibility() {
    markers.forEach(m => {
      const loc = m._locationData;
      if (!loc) return;
      if (isTypeVisible(loc.type) && loc.visible) {
        if (!map.hasLayer(m)) m.addTo(map);
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    });
  }

  // ── Regions / Polygons ────────────────────────────────────

  let regions = [];
  const regionLayers = [];
  const regionLayerGroup = L.layerGroup();
  let regionsVisible = false;
  const hiddenRegions = new Set();

  function loadRegions() {
    return new Promise((resolve) => {
      Papa.parse('data/regions.csv', {
        download: true, header: true, skipEmptyLines: true,
        complete: function (results) {
          regions = results.data.map(processRegion).filter(Boolean);
          console.log(`Loaded ${regions.length} regions`);
          resolve(regions);
        },
        error: function () {
          console.log('No regions.csv found (optional)');
          resolve([]);
        },
      });
    });
  }

  function processRegion(row) {
    if (!row.name || !row.coordinates) return null;
    const coordPairs = row.coordinates.trim().split(/\s+/);
    const latLngs = [];
    for (const pair of coordPairs) {
      const match = pair.match(/^(\d+)\.(\d+)$/);
      if (!match) continue;
      const gx = parseInt(match[1], 10);
      const gy = parseInt(match[2], 10);
      const [px, py] = gridToPixel(gx, gy);
      latLngs.push(pxToLatLng(px, py));
    }
    if (latLngs.length < 3) return null;

    return {
      name: row.name,
      description: row.description || '',
      color: row.color || '#c8b888',
      fillOpacity: parseFloat(row.fill_opacity) || 0.15,
      borderOpacity: parseFloat(row.border_opacity) || 0.6,
      latLngs,
    };
  }

  function createRegions() {
    regionLayers.length = 0;
    regionLayerGroup.clearLayers();

    regions.forEach(reg => {
      const poly = L.polygon(reg.latLngs, {
        color: reg.color, weight: 2, opacity: reg.borderOpacity,
        fillColor: reg.color, fillOpacity: reg.fillOpacity, interactive: true,
      });
      const popupHtml = `
        <h3>${reg.name}</h3>
        ${reg.description ? `<div class="description">${reg.description}</div>` : ''}
      `;
      poly.bindPopup(popupHtml, { maxWidth: 350 });
      poly._regionData = reg;
      regionLayers.push(poly);
      if (!hiddenRegions.has(reg.name)) {
        poly.addTo(regionLayerGroup);
      }
    });
  }

  document.getElementById('regionsToggle').addEventListener('click', function () {
    if (regionsVisible) {
      map.removeLayer(regionLayerGroup);
      regionsVisible = false;
      this.textContent = 'Regions: OFF';
      this.classList.remove('active');
    } else {
      regionLayerGroup.addTo(map);
      regionsVisible = true;
      this.textContent = 'Regions: ON';
      this.classList.add('active');
    }
  });

  function refreshRegionVisibility() {
    regionLayers.forEach(poly => {
      const reg = poly._regionData;
      if (!reg) return;
      if (hiddenRegions.has(reg.name)) {
        if (regionLayerGroup.hasLayer(poly)) regionLayerGroup.removeLayer(poly);
      } else {
        if (!regionLayerGroup.hasLayer(poly)) poly.addTo(regionLayerGroup);
      }
    });
  }

  // ── Sidebar: Tabs, Toggles, List ──────────────────────────

  const sidebarTabsEl   = document.getElementById('sidebarTabs');
  const typeTogglesEl   = document.getElementById('typeToggles');
  const regionTogglesEl = document.getElementById('regionToggles');
  const sidebarListEl   = document.getElementById('sidebarList');
  const sidebarFooterEl = document.getElementById('sidebarFooter');
  const searchInput     = document.getElementById('searchInput');

  let activeTab = 'all';
  let knownTypes = [];

  function discoverTypes() {
    const typeSet = new Set();
    locations.forEach(loc => {
      if (loc.visible) typeSet.add(normalizeType(loc.type));
    });
    const order = ['city', 'location', 'dungeon', 'portal', 'castle_or_fort', 'player_owned'];
    knownTypes = order.filter(t => typeSet.has(t));
    typeSet.forEach(t => {
      if (!knownTypes.includes(t)) knownTypes.push(t);
    });
  }

  function buildTabs() {
    sidebarTabsEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'sidebar-tab' + (activeTab === 'all' ? ' active' : '');
    const allCount = locations.filter(l => l.visible && isTypeVisible(l.type)).length;
    allBtn.innerHTML = `All <span class="tab-count">${allCount}</span>`;
    allBtn.addEventListener('click', () => { activeTab = 'all'; buildTabs(); renderList(); });
    sidebarTabsEl.appendChild(allBtn);

    knownTypes.forEach(type => {
      const meta = getTypeMeta(type);
      const count = locations.filter(l => l.visible && normalizeType(l.type) === type && isTypeVisible(l.type)).length;
      const btn = document.createElement('button');
      btn.className = 'sidebar-tab' + (activeTab === type ? ' active' : '');
      btn.innerHTML = `${meta.label} <span class="tab-count">${count}</span>`;
      btn.addEventListener('click', () => { activeTab = type; buildTabs(); renderList(); });
      sidebarTabsEl.appendChild(btn);
    });

    // Wilderness Travel tab
    const wildBtn = document.createElement('button');
    wildBtn.className = 'sidebar-tab' + (activeTab === 'wilderness' ? ' active' : '');
    wildBtn.innerHTML = `&#x1f332; Wilderness`;
    wildBtn.addEventListener('click', () => { activeTab = 'wilderness'; buildTabs(); renderList(); });
    sidebarTabsEl.appendChild(wildBtn);
  }

  function buildTypeToggles() {
    typeTogglesEl.innerHTML = '';
    knownTypes.forEach(type => {
      const meta = getTypeMeta(type);
      const el = document.createElement('div');
      el.className = 'type-toggle' + (hiddenTypes.has(type) ? ' hidden-type' : '');
      el.innerHTML = `<span class="toggle-dot" style="background:${meta.color}"></span>${meta.label}`;
      el.addEventListener('click', () => {
        if (hiddenTypes.has(type)) { hiddenTypes.delete(type); }
        else { hiddenTypes.add(type); }
        refreshTypeVisibility();
        buildTypeToggles();
        buildTabs();
        renderList();
      });
      typeTogglesEl.appendChild(el);
    });
  }

  function buildRegionToggles() {
    regionTogglesEl.innerHTML = '';
    if (regions.length === 0) { regionTogglesEl.style.display = 'none'; return; }
    regionTogglesEl.style.display = '';

    const seen = new Set();
    regions.forEach(reg => {
      if (seen.has(reg.name)) return;
      seen.add(reg.name);
      const el = document.createElement('div');
      el.className = 'region-toggle' + (hiddenRegions.has(reg.name) ? ' hidden-region' : '');
      el.innerHTML = `<span class="toggle-swatch" style="background:${reg.color}"></span>${reg.name}`;
      el.addEventListener('click', () => {
        if (hiddenRegions.has(reg.name)) { hiddenRegions.delete(reg.name); }
        else { hiddenRegions.add(reg.name); }
        refreshRegionVisibility();
        buildRegionToggles();
      });
      regionTogglesEl.appendChild(el);
    });
  }

  function getFilteredLocations() {
    const q = searchInput.value.toLowerCase().trim();
    return locations.filter(loc => {
      if (!loc.visible) return false;
      if (!isTypeVisible(loc.type)) return false;
      if (activeTab === 'wilderness') return false;
      if (activeTab !== 'all' && normalizeType(loc.type) !== activeTab) return false;
      if (q) {
        const searchable = [loc.name, loc.type, loc.description, formatGrid(loc.gridX, loc.gridY)]
          .map(s => (s || '').toLowerCase()).join(' ');
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }

  const wildernessPanel = document.getElementById('wildernessPanel');

  function renderList() {
    // Wilderness tab: show wilderness panel, hide location list
    if (activeTab === 'wilderness') {
      sidebarListEl.style.display = 'none';
      wildernessPanel.style.display = '';
      sidebarFooterEl.textContent = '';
      typeTogglesEl.style.display = 'none';
      regionTogglesEl.style.display = 'none';
      return;
    }
    sidebarListEl.style.display = '';
    wildernessPanel.style.display = 'none';

    const filtered = getFilteredLocations();
    sidebarListEl.innerHTML = '';

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    filtered.forEach(loc => {
      const ntype = normalizeType(loc.type);
      const meta = getTypeMeta(ntype);
      const iconUrl = ICON_MAP[ntype] || DEFAULT_ICON;

      const div = document.createElement('div');
      div.className = 'loc-item';
      div.innerHTML = `
        <div class="loc-item-name">
          <img src="${iconUrl}" alt="" />
          ${loc.name}
        </div>
        <div class="loc-item-grid">${formatGrid(loc.gridX, loc.gridY)} &middot; <span style="color:${meta.color}">${meta.label}</span></div>
        ${loc.description ? `<div class="loc-item-desc">${loc.description.substring(0, 120)}${loc.description.length > 120 ? '...' : ''}</div>` : ''}
      `;
      div.addEventListener('click', () => {
        flyToLocation(loc);
        sidebarListEl.querySelectorAll('.loc-item').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
      });
      sidebarListEl.appendChild(div);
    });

    sidebarFooterEl.textContent = `${filtered.length} location${filtered.length !== 1 ? 's' : ''}`;
  }

  function flyToLocation(loc) {
    const [px, py] = gridToPixel(loc.gridX, loc.gridY);
    const latLng = pxToLatLng(px, py);
    map.flyTo(latLng, Math.max(map.getZoom(), 3));
    const m = markers.find(mk => mk._locationData === loc);
    if (m) { setTimeout(() => m.openPopup(), 400); }
  }

  // ── Search ────────────────────────────────────────────────

  searchInput.addEventListener('input', function () {
    renderList();
    const q = this.value.toLowerCase().trim();
    markers.forEach(m => {
      const el = m.getElement?.();
      if (!q) {
        m.setOpacity(1);
        el?.classList.remove('search-hit', 'search-dim');
        return;
      }
      const l = m._locationData;
      const hit = [l.name, l.type, l.description, formatGrid(l.gridX, l.gridY)]
        .some(s => s && s.toLowerCase().includes(q));
      if (hit) {
        m.setOpacity(1);
        el?.classList.add('search-hit');
        el?.classList.remove('search-dim');
      } else {
        m.setOpacity(0.3);
        el?.classList.remove('search-hit');
        el?.classList.add('search-dim');
      }
    });
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const filtered = getFilteredLocations();
      if (filtered.length > 0) { flyToLocation(filtered[0]); }
    }
  });

  // ── Keyboard Shortcuts ────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.blur();
      map.closePopup();
      markers.forEach(m => {
        m.setOpacity(1);
        m.getElement?.()?.classList.remove('search-hit', 'search-dim');
      });
      renderList();
    }
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInput) {
      document.getElementById('gridToggle').click();
    }
  });

  // ── Travel Distance Calculator ────────────────────────────

  const travelPanel      = document.getElementById('travelPanel');
  const travelToggleBtn  = document.getElementById('travelToggle');
  const travelCloseBtn   = document.getElementById('travelClose');
  const travelResetBtn   = document.getElementById('travelReset');
  const travelSpeedInput = document.getElementById('travelSpeed');
  const travelInstructions = document.getElementById('travelInstructions');
  const travelPointAEl   = document.getElementById('travelPointA').querySelector('.point-value');
  const travelPointBEl   = document.getElementById('travelPointB').querySelector('.point-value');
  const travelResultEl   = document.getElementById('travelResult');

  let travelPointA = null;
  let travelPointB = null;
  const travelMarkers = [];
  let travelLine = null;

  // Grid-based movement: diagonal costs 1.5x a cardinal step
  function calcGridDistance(ax, ay, bx, by) {
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    const diag = Math.min(dx, dy);
    const straight = Math.abs(dx - dy);
    return diag * 1.5 + straight;
  }

  function updateTravelResult() {
    if (!travelPointA || !travelPointB) { travelResultEl.classList.remove('visible'); return; }
    const speed = Math.max(1, parseInt(travelSpeedInput.value, 10) || 24);
    const distSquares = calcGridDistance(travelPointA.gx, travelPointA.gy, travelPointB.gx, travelPointB.gy);
    const distMiles = distSquares * 5;
    const travelDays = distSquares / speed;

    let daysStr;
    if (travelDays < 1) {
      const hours = travelDays * 8;
      daysStr = hours < 1 ? `< 1 hour` : `~${hours.toFixed(1)} hours (of an 8-hr travel day)`;
    } else {
      daysStr = `${travelDays.toFixed(1)} day${travelDays >= 1.05 ? 's' : ''}`;
    }

    travelResultEl.innerHTML = `
      <div>Grid distance: <span class="result-value">${distSquares.toFixed(1)} squares</span></div>
      <div>Distance: <span class="result-value">${distMiles.toFixed(1)} miles</span></div>
      <div>Travel time: <span class="result-value">${daysStr}</span></div>
      <div style="font-size:11px;color:#888;margin-top:4px;">At ${speed} squares/day · 5 mi/square</div>
    `;
    travelResultEl.classList.add('visible');
  }

  function clearTravelPoints() {
    travelPointA = null; travelPointB = null;
    travelPointAEl.textContent = '—'; travelPointBEl.textContent = '—';
    travelResultEl.classList.remove('visible');
    travelMarkers.forEach(m => map.removeLayer(m));
    travelMarkers.length = 0;
    if (travelLine) { map.removeLayer(travelLine); travelLine = null; }
    travelInstructions.textContent = 'Click two points on the map to measure travel distance.';
  }

  function addTravelMarker(gx, gy, isA) {
    const [px, py] = gridToPixel(gx, gy);
    const latLng = pxToLatLng(px, py);
    const icon = L.divIcon({
      className: `travel-marker ${isA ? 'point-a' : 'point-b'}`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const m = L.marker(latLng, { icon, interactive: false, zIndexOffset: 9000 }).addTo(map);
    travelMarkers.push(m);
    return latLng;
  }

  function drawTravelLine() {
    if (travelLine) { map.removeLayer(travelLine); travelLine = null; }
    if (!travelPointA || !travelPointB) return;
    const [pxA, pyA] = gridToPixel(travelPointA.gx, travelPointA.gy);
    const [pxB, pyB] = gridToPixel(travelPointB.gx, travelPointB.gy);
    travelLine = L.polyline(
      [pxToLatLng(pxA, pyA), pxToLatLng(pxB, pyB)],
      { color: '#c8b888', weight: 2, dashArray: '8 6', opacity: 0.8 }
    ).addTo(map);
  }

  function handleTravelClick(e) {
    if (!travelMode) return;
    const px = e.latlng.lng;
    const py = -e.latlng.lat;
    if (px < 0 || px > C.imageWidth || py < 0 || py > C.imageHeight) return;
    const [gx, gy] = pixelToGrid(px, py);
    const snappedX = Math.round(gx);
    const snappedY = Math.round(gy);

    if (!travelPointA) {
      travelPointA = { gx: snappedX, gy: snappedY };
      travelPointAEl.textContent = formatGrid(snappedX, snappedY);
      addTravelMarker(snappedX, snappedY, true);
      travelInstructions.textContent = 'Now click the destination point.';
    } else if (!travelPointB) {
      travelPointB = { gx: snappedX, gy: snappedY };
      travelPointBEl.textContent = formatGrid(snappedX, snappedY);
      addTravelMarker(snappedX, snappedY, false);
      drawTravelLine();
      updateTravelResult();
      travelInstructions.textContent = 'Done! Reset to measure again.';
    }
    e.originalEvent._travelHandled = true;
  }

  function enableTravelMode() {
    travelMode = true;
    travelPanel.classList.add('active');
    travelToggleBtn.classList.add('active');
    travelToggleBtn.textContent = 'Travel: ON';
    document.getElementById('map').classList.add('travel-cursor');
    map.on('click', handleTravelClick);
  }

  function disableTravelMode() {
    travelMode = false;
    travelPanel.classList.remove('active');
    travelToggleBtn.classList.remove('active');
    travelToggleBtn.textContent = 'Travel';
    document.getElementById('map').classList.remove('travel-cursor');
    map.off('click', handleTravelClick);
    clearTravelPoints();
  }

  travelToggleBtn.addEventListener('click', function () {
    if (travelMode) { disableTravelMode(); } else { enableTravelMode(); }
  });
  travelCloseBtn.addEventListener('click', disableTravelMode);
  travelResetBtn.addEventListener('click', clearTravelPoints);
  travelSpeedInput.addEventListener('input', updateTravelResult);

  // ── Wilderness Travel Panel ──────────────────────────────

  function buildWildernessPanel() {
    wildernessPanel.innerHTML = `
      <div class="wilderness-content">
        <h3 class="wilderness-title">Wilderness Travel</h3>

        <details class="wilderness-section" open>
          <summary>Daily Procedure</summary>
          <ol class="wilderness-list">
            <li><strong>START</strong> — Roll for Lost &amp; Encounters at dawn.</li>
            <li><strong>MOVE</strong> — Party moves its daily rate (squares/day).</li>
            <li><strong>INTERACTION</strong> — Resolve encounters, exploration, foraging.</li>
            <li><strong>CAMP</strong> — Set watches, roll night encounters.</li>
            <li><strong>REPEAT</strong></li>
          </ol>
        </details>

        <details class="wilderness-section" open>
          <summary>Getting Lost &amp; Encounter Chance</summary>
          <table class="wilderness-table">
            <thead><tr><th>Terrain</th><th>Lost (d6)</th><th>Encounter (d6)</th></tr></thead>
            <tbody>
              <tr><td>Clear</td><td>1</td><td>6</td></tr>
              <tr><td>Woods</td><td>1–2</td><td>5–6</td></tr>
              <tr><td>River</td><td>1</td><td>5–6</td></tr>
              <tr><td>Swamp</td><td>1–3</td><td>4–6</td></tr>
              <tr><td>Mtns.</td><td>1–2</td><td>4–6</td></tr>
              <tr><td>Desert</td><td>1–3</td><td>5–6</td></tr>
              <tr><td>Ocean</td><td>1–3</td><td>4–6</td></tr>
            </tbody>
          </table>
        </details>

        <details class="wilderness-section">
          <summary>Wandering Monsters (d10)</summary>
          <div class="wilderness-table-scroll">
          <table class="wilderness-table wilderness-table-wide">
            <thead><tr><th>d10</th><th>Clear</th><th>Woods</th><th>River</th><th>Swamp</th><th>Mtns.</th><th>Desert</th><th>Ocean</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Men</td><td>Men</td><td>Men</td><td>Men</td><td>Men</td><td>Men</td><td>Men</td></tr>
              <tr><td>2</td><td>Flyer</td><td>Flyer</td><td>Flyer</td><td>Flyer</td><td>Flyer</td><td>Flyer</td><td>Flyer</td></tr>
              <tr><td>3</td><td>Man-Like</td><td>Man-Like</td><td>Man-Like</td><td>Man-Like</td><td>Man-Like</td><td>Man-Like</td><td>Undead</td></tr>
              <tr><td>4</td><td>Lycanth.</td><td>Lycanth.</td><td>Lycanth.</td><td>Lycanth.</td><td>Lycanth.</td><td>Men</td><td>Strange</td></tr>
              <tr><td>5</td><td>Animals</td><td>Lycanth.</td><td>Swimmer</td><td>Swimmer</td><td>Animals</td><td>Animals</td><td>Undead</td></tr>
              <tr><td>6</td><td>Men</td><td>Men</td><td>Men</td><td>Undead</td><td>Man-Like</td><td>Dragon</td><td>Dragon</td></tr>
              <tr><td>7</td><td>Animals</td><td>Animals</td><td>Animals</td><td>Daemon*</td><td>Men</td><td>Animals</td><td>Man-Like</td></tr>
              <tr><td>8</td><td>Men</td><td>Men</td><td>Swimmer</td><td>Dragon</td><td>Dragon</td><td>Undead</td><td>Daemon*</td></tr>
              <tr><td>9</td><td>Daemon*</td><td>Daemon*</td><td>Swimmer</td><td>Strange</td><td>Daemon*</td><td>Strange</td><td>Strange</td></tr>
              <tr><td>10</td><td>Strange</td><td>Strange</td><td>Strange</td><td>Strange</td><td>Strange</td><td>Strange</td><td>Strange</td></tr>
            </tbody>
          </table>
          </div>
        </details>

        <details class="wilderness-section">
          <summary>Encounter Type (d12)</summary>
          <table class="wilderness-table">
            <thead><tr><th>d12</th><th>Result</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Traces / Tracks</td></tr>
              <tr><td>2</td><td>Lair</td></tr>
              <tr><td>3–4</td><td>Hostile (attacks on sight)</td></tr>
              <tr><td>5–6</td><td>Cautious / Stalking</td></tr>
              <tr><td>7–8</td><td>Neutral (ignores unless provoked)</td></tr>
              <tr><td>9–10</td><td>Friendly / Helpful</td></tr>
              <tr><td>11</td><td>In distress / injured</td></tr>
              <tr><td>12</td><td>Special event or omen</td></tr>
            </tbody>
          </table>
        </details>

        <details class="wilderness-section">
          <summary>Hybrid Monster (d100)</summary>
          <table class="wilderness-table">
            <thead><tr><th>d100</th><th>Base Form</th></tr></thead>
            <tbody>
              <tr><td>01–10</td><td>Humanoid</td></tr>
              <tr><td>11–20</td><td>Beast (mammal)</td></tr>
              <tr><td>21–30</td><td>Reptilian</td></tr>
              <tr><td>31–40</td><td>Avian</td></tr>
              <tr><td>41–50</td><td>Insectoid</td></tr>
              <tr><td>51–60</td><td>Aquatic / Amphibian</td></tr>
              <tr><td>61–70</td><td>Plant / Fungal</td></tr>
              <tr><td>71–80</td><td>Elemental</td></tr>
              <tr><td>81–90</td><td>Aberration / Ooze</td></tr>
              <tr><td>91–100</td><td>Undead / Spectral</td></tr>
            </tbody>
          </table>
        </details>

        <details class="wilderness-section">
          <summary>Infusion Modifier (d20)</summary>
          <table class="wilderness-table">
            <thead><tr><th>d20</th><th>Modifier</th></tr></thead>
            <tbody>
              <tr><td>1–4</td><td>None (pure base form)</td></tr>
              <tr><td>5–6</td><td>Fire / Magma</td></tr>
              <tr><td>7–8</td><td>Ice / Frost</td></tr>
              <tr><td>9–10</td><td>Lightning / Storm</td></tr>
              <tr><td>11–12</td><td>Shadow / Void</td></tr>
              <tr><td>13–14</td><td>Poison / Acid</td></tr>
              <tr><td>15–16</td><td>Psychic / Psionic</td></tr>
              <tr><td>17–18</td><td>Radiant / Holy</td></tr>
              <tr><td>19</td><td>Necrotic</td></tr>
              <tr><td>20</td><td>Chaos-touched (roll twice on Infusion)</td></tr>
            </tbody>
          </table>
        </details>

        <details class="wilderness-section">
          <summary>Immunity Codes</summary>
          <table class="wilderness-table">
            <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td>A</td><td>Immune to non-magical weapons</td></tr>
              <tr><td>B</td><td>Immune to fire</td></tr>
              <tr><td>C</td><td>Immune to cold</td></tr>
              <tr><td>D</td><td>Immune to lightning</td></tr>
              <tr><td>E</td><td>Immune to poison</td></tr>
              <tr><td>F</td><td>Immune to psychic / charm / fear</td></tr>
              <tr><td>G</td><td>Resistant to all magic (advantage on saves)</td></tr>
              <tr><td>*</td><td>Daemon — immune to A + E, resist G</td></tr>
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // ── Init ──────────────────────────────────────────────────

  async function init() {
    try {
      await Promise.all([loadLocations(), loadRegions()]);
      discoverTypes();
      createMarkers();
      createRegions();
      buildTabs();
      buildTypeToggles();
      buildRegionToggles();
      buildWildernessPanel();
      renderList();

      // Initialize drawing tools & party token
      if (window.initDrawTools) {
        window.initDrawTools(map, {
          pxToLatLng,
          gridToPixel,
          pixelToGrid,
          formatGrid,
          imageWidth: C.imageWidth,
          imageHeight: C.imageHeight,
        });
      }
    } catch (err) {
      console.warn('Init error:', err);
    }
    document.getElementById('loading').classList.add('hidden');
    setTimeout(() => document.getElementById('loading')?.remove(), 600);
  }

  setTimeout(init, 300);
})();
