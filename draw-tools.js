/**
 * Drawing Tools & Party Token for Leaflet Maps
 * Provides: freehand pen, shapes (line, rect, circle, arrow), text labels,
 *           eraser, color/size pickers, and a draggable party token.
 * All drawings are temporary (session-only, cleared on reload).
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Expose a factory so app.js can call  initDrawTools(map, helpers)   */
  /* ------------------------------------------------------------------ */
  window.initDrawTools = function (map, helpers) {
    const { pxToLatLng, gridToPixel, pixelToGrid, formatGrid, imageWidth, imageHeight } = helpers;

    // ── State ──────────────────────────────────────────────────────
    let drawMode = null;        // null | 'pen' | 'line' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser'
    let drawColor = '#ff4444';
    let drawWidth = 3;
    let isDrawing = false;
    let currentPath = [];
    let currentLayer = null;
    let shapeStart = null;

    const drawnLayers = L.layerGroup().addTo(map);

    // ── Toolbar HTML ────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.id = 'drawToolbar';
    toolbar.innerHTML = `
      <div class="draw-toolbar-row">
        <button class="draw-tool-btn" data-tool="pen" title="Freehand Pen">&#9999;&#65039;</button>
        <button class="draw-tool-btn" data-tool="line" title="Line">&#9585;</button>
        <button class="draw-tool-btn" data-tool="rect" title="Rectangle">&#9634;</button>
        <button class="draw-tool-btn" data-tool="circle" title="Circle">&#9675;</button>
        <button class="draw-tool-btn" data-tool="arrow" title="Arrow">&#10148;</button>
        <button class="draw-tool-btn" data-tool="text" title="Text Label">T</button>
        <button class="draw-tool-btn" data-tool="eraser" title="Eraser (click to remove)">&#128465;</button>
      </div>
      <div class="draw-toolbar-row draw-options">
        <input type="color" id="drawColor" value="#ff4444" title="Drawing color" />
        <label class="draw-width-label">
          <input type="range" id="drawWidth" min="1" max="12" value="3" title="Line width" />
        </label>
        <button class="draw-tool-btn draw-clear-btn" id="drawClearAll" title="Clear all drawings">&#128465; All</button>
        <button class="draw-tool-btn draw-close-btn" id="drawClose" title="Close drawing mode">&times;</button>
      </div>
    `;
    document.body.appendChild(toolbar);

    // ── Toolbar Events ──────────────────────────────────────────────
    const toolBtns = toolbar.querySelectorAll('[data-tool]');
    const colorInput = document.getElementById('drawColor');
    const widthInput = document.getElementById('drawWidth');

    colorInput.addEventListener('input', e => { drawColor = e.target.value; });
    widthInput.addEventListener('input', e => { drawWidth = parseInt(e.target.value, 10); });

    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (drawMode === tool) {
          deactivateDraw();
        } else {
          activateDraw(tool);
        }
      });
    });

    document.getElementById('drawClearAll').addEventListener('click', () => {
      drawnLayers.clearLayers();
    });

    document.getElementById('drawClose').addEventListener('click', () => {
      deactivateDraw();
      toolbar.classList.remove('visible');
      drawToggleBtn.classList.remove('active');
    });

    function activateDraw(tool) {
      drawMode = tool;
      toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
      map.dragging.disable();
      map.doubleClickZoom.disable();
      document.getElementById('map').classList.add('draw-cursor');

      if (tool === 'eraser') {
        document.getElementById('map').classList.add('eraser-cursor');
      } else {
        document.getElementById('map').classList.remove('eraser-cursor');
      }
    }

    function deactivateDraw() {
      drawMode = null;
      isDrawing = false;
      currentPath = [];
      currentLayer = null;
      shapeStart = null;
      toolBtns.forEach(b => b.classList.remove('active'));
      map.dragging.enable();
      map.doubleClickZoom.enable();
      document.getElementById('map').classList.remove('draw-cursor', 'eraser-cursor');
    }

    // ── Drawing Button in Map Controls ──────────────────────────────
    const drawToggleBtn = document.createElement('button');
    drawToggleBtn.className = 'map-btn';
    drawToggleBtn.id = 'drawToggle';
    drawToggleBtn.textContent = 'Draw';
    drawToggleBtn.title = 'Toggle drawing tools';

    // Insert before the Campaign Links button
    const mapControls = document.querySelector('.map-controls');
    const campaignLink = mapControls.querySelector('a');
    if (campaignLink) {
      mapControls.insertBefore(drawToggleBtn, campaignLink);
    } else {
      mapControls.appendChild(drawToggleBtn);
    }

    drawToggleBtn.addEventListener('click', () => {
      if (toolbar.classList.contains('visible')) {
        deactivateDraw();
        toolbar.classList.remove('visible');
        drawToggleBtn.classList.remove('active');
      } else {
        toolbar.classList.add('visible');
        drawToggleBtn.classList.add('active');
      }
    });

    // ── Map Drawing Handlers ────────────────────────────────────────
    map.on('mousedown', onDrawStart);
    map.on('mousemove', onDrawMove);
    map.on('mouseup', onDrawEnd);
    map.on('click', onDrawClick);

    function onDrawStart(e) {
      if (!drawMode || drawMode === 'text' || drawMode === 'eraser') return;
      isDrawing = true;
      const ll = e.latlng;

      if (drawMode === 'pen') {
        currentPath = [ll];
        currentLayer = L.polyline(currentPath, {
          color: drawColor, weight: drawWidth, opacity: 0.9,
          lineCap: 'round', lineJoin: 'round',
        }).addTo(drawnLayers);
      } else {
        // Shapes: line, rect, circle, arrow
        shapeStart = ll;
        if (drawMode === 'line' || drawMode === 'arrow') {
          currentLayer = L.polyline([ll, ll], {
            color: drawColor, weight: drawWidth, opacity: 0.9,
          }).addTo(drawnLayers);
        } else if (drawMode === 'rect') {
          currentLayer = L.rectangle([ll, ll], {
            color: drawColor, weight: drawWidth, fill: false, opacity: 0.9,
          }).addTo(drawnLayers);
        } else if (drawMode === 'circle') {
          currentLayer = L.circle(ll, {
            radius: 0, color: drawColor, weight: drawWidth, fill: false, opacity: 0.9,
          }).addTo(drawnLayers);
        }
      }
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
    }

    function onDrawMove(e) {
      if (!isDrawing || !drawMode) return;
      const ll = e.latlng;

      if (drawMode === 'pen') {
        currentPath.push(ll);
        currentLayer.setLatLngs(currentPath);
      } else if (drawMode === 'line') {
        currentLayer.setLatLngs([shapeStart, ll]);
      } else if (drawMode === 'arrow') {
        currentLayer.setLatLngs([shapeStart, ll]);
      } else if (drawMode === 'rect') {
        currentLayer.setBounds(L.latLngBounds(shapeStart, ll));
      } else if (drawMode === 'circle') {
        currentLayer.setRadius(shapeStart.distanceTo(ll));
      }
    }

    function onDrawEnd(e) {
      if (!isDrawing || !drawMode) return;
      isDrawing = false;

      // Add arrowhead for arrow tool
      if (drawMode === 'arrow' && shapeStart && currentLayer) {
        addArrowhead(shapeStart, e.latlng, drawColor, drawWidth);
      }

      currentLayer = null;
      shapeStart = null;
    }

    function onDrawClick(e) {
      if (!drawMode) return;

      if (drawMode === 'text') {
        e.originalEvent._drawHandled = true;
        const text = prompt('Enter text label:');
        if (!text) return;
        const fontSize = Math.max(14, drawWidth * 5);
        const icon = L.divIcon({
          className: 'draw-text-label',
          html: `<span style="color:${drawColor};font-size:${fontSize}px;text-shadow:-1px -1px 0 rgba(0,0,0,0.7),1px -1px 0 rgba(0,0,0,0.7),-1px 1px 0 rgba(0,0,0,0.7),1px 1px 0 rgba(0,0,0,0.7);white-space:nowrap;font-weight:bold;">${text}</span>`,
          iconSize: null,
          iconAnchor: [0, 0],
        });
        const marker = L.marker(e.latlng, { icon, interactive: true, draggable: true }).addTo(drawnLayers);
        // Allow deleting text labels with right-click
        marker.on('contextmenu', () => { drawnLayers.removeLayer(marker); });
      }

      if (drawMode === 'eraser') {
        e.originalEvent._drawHandled = true;
        const clickPt = e.latlng;
        const tolerance = 20 / Math.pow(2, map.getZoom()); // pixel tolerance adjusted for zoom
        let closest = null;
        let closestDist = Infinity;

        drawnLayers.eachLayer(layer => {
          if (layer._partyToken) return; // Don't erase party token
          let dist;
          if (layer.getLatLng) {
            dist = clickPt.distanceTo(layer.getLatLng());
          } else if (layer.getLatLngs) {
            const pts = layer.getLatLngs().flat();
            dist = Math.min(...pts.map(p => clickPt.distanceTo(p)));
          } else if (layer.getBounds) {
            dist = 0; // rectangles – check if click is inside
            if (layer.getBounds().contains(clickPt)) dist = 0;
            else dist = Infinity;
          }
          if (dist < closestDist) { closestDist = dist; closest = layer; }
        });

        if (closest && closestDist < tolerance) {
          drawnLayers.removeLayer(closest);
          // Also remove associated arrowheads
          if (closest._arrowhead) drawnLayers.removeLayer(closest._arrowhead);
        }
      }
    }

    function addArrowhead(from, to, color, weight) {
      const dx = to.lng - from.lng;
      const dy = to.lat - from.lat;
      const angle = Math.atan2(dy, dx);
      const headLen = Math.max(30, weight * 10) / Math.pow(2, map.getZoom());
      const a1 = angle + Math.PI * 0.8;
      const a2 = angle - Math.PI * 0.8;

      const tip = to;
      const p1 = L.latLng(to.lat + Math.sin(a1) * headLen, to.lng + Math.cos(a1) * headLen);
      const p2 = L.latLng(to.lat + Math.sin(a2) * headLen, to.lng + Math.cos(a2) * headLen);

      const arrowhead = L.polyline([p1, tip, p2], {
        color, weight: weight + 1, opacity: 0.9,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(drawnLayers);
      if (currentLayer) currentLayer._arrowhead = arrowhead;
    }

    // ── Party Token ─────────────────────────────────────────────────
    const PARTY_ICON_URL = 'icons/party-token.svg';
    let partyMarker = null;
    let partyVisible = false;

    const partyToggleBtn = document.createElement('button');
    partyToggleBtn.className = 'map-btn';
    partyToggleBtn.id = 'partyToggle';
    partyToggleBtn.textContent = 'Party';
    partyToggleBtn.title = 'Place/toggle party token on map';

    if (campaignLink) {
      mapControls.insertBefore(partyToggleBtn, campaignLink);
    } else {
      mapControls.appendChild(partyToggleBtn);
    }

    function makePartyIcon(size) {
      return L.icon({
        iconUrl: PARTY_ICON_URL,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2 + 4)],
        className: 'party-token-icon',
      });
    }

    function getPartySize() {
      return Math.max(32, Math.round(40 + map.getZoom() * 6));
    }

    partyToggleBtn.addEventListener('click', () => {
      if (partyVisible && partyMarker) {
        // Remove party token
        map.removeLayer(partyMarker);
        partyMarker = null;
        partyVisible = false;
        partyToggleBtn.classList.remove('active');
        partyToggleBtn.textContent = 'Party';
      } else {
        // Place at map center
        const center = map.getCenter();
        const size = getPartySize();
        partyMarker = L.marker(center, {
          icon: makePartyIcon(size),
          draggable: true,
          zIndexOffset: 10000,
          interactive: true,
        }).addTo(map);
        partyMarker._partyToken = true;

        // Show grid square on drag
        partyMarker.on('dragend', function () {
          const ll = partyMarker.getLatLng();
          const px = ll.lng;
          const py = -ll.lat;
          if (px >= 0 && px <= imageWidth && py >= 0 && py <= imageHeight) {
            const [gx, gy] = pixelToGrid(px, py);
            partyMarker.bindPopup(
              `<div style="text-align:center;">
                <strong style="color:#c8b888;">Party Location</strong><br/>
                <span class="grid-ref">Square: ${formatGrid(gx, gy)}</span>
              </div>`,
              { maxWidth: 200 }
            ).openPopup();
          }
        });

        // Show initial popup
        const px = center.lng;
        const py = -center.lat;
        if (px >= 0 && px <= imageWidth && py >= 0 && py <= imageHeight) {
          const [gx, gy] = pixelToGrid(px, py);
          partyMarker.bindPopup(
            `<div style="text-align:center;">
              <strong style="color:#c8b888;">Party Location</strong><br/>
              <span class="grid-ref">Square: ${formatGrid(gx, gy)}</span><br/>
              <span style="color:#888;font-size:11px;">Drag to move</span>
            </div>`,
            { maxWidth: 200 }
          ).openPopup();
        }

        partyVisible = true;
        partyToggleBtn.classList.add('active');
        partyToggleBtn.textContent = 'Party: ON';
      }
    });

    // Resize party token on zoom
    map.on('zoomend', () => {
      if (partyMarker && partyVisible) {
        partyMarker.setIcon(makePartyIcon(getPartySize()));
      }
    });

    // ── Keyboard shortcut: Escape exits draw mode ───────────────
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawMode) {
        deactivateDraw();
      }
    });
  };
})();
