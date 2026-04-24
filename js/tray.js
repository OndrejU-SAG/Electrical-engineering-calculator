/* =====================================================================
   CABLE TRAY / CONDUIT FILL CALCULATOR
   IEC 60364-5-52  ·  NEC 392 / NEC 358
   ===================================================================== */

/* Standard cable outer diameters (mm) estimated from cross-section
   Based on typical single-core PVC-insulated cables (conductor + insulation) */
const TRAY_XSEC_OD = {
  1.5: 6.5, 2.5: 7.5, 4: 8.5, 6: 9.5, 10: 12.0, 16: 14.0,
  25: 17.0, 35: 19.0, 50: 22.0, 70: 26.0, 95: 30.0, 120: 34.0
};

const TRAY_XSEC_LIST = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

/* Fill limits per IEC 60364-5-52 / NEC 392-80 */
const TRAY_LIMITS = {
  single: { iec: 53, nec: 53 },
  two:    { iec: 31, nec: 31 },
  power:  { iec: 40, nec: 40 },
  signal: { iec: 50, nec: 50 },
  mixed:  { iec: 40, nec: 40 }
};

/* Rule descriptions per language */
const TRAY_RULE_DESC = {
  single: { eng: 'Single cable',                              cze: 'Jeden kabel',                          deu: 'Ein Kabel' },
  two:    { eng: '2 cables',                                  cze: '2 kabely',                             deu: '2 Kabel' },
  power:  { eng: '3+ power cables',                          cze: '3+ silové kabely',                     deu: '3+ Energiekabel' },
  signal: { eng: '3+ control / signal cables',               cze: '3+ řídicí / signálové kabely',          deu: '3+ Steuer-/Signalkabel' },
  mixed:  { eng: '3+ mixed cables (power + other)',          cze: '3+ různé kabely (silové + jiné)',       deu: '3+ gemischte Kabel (Energie + andere)' }
};

/* ---- Module state ---- */
let _trayGeomMode    = 'rect';
let _trayConduitType = 'round';
let _trayTrayType    = 'ladder';
let _trayStandard    = 'iec';
let _trayRows        = [];
let _trayNextId      = 0;
let _trayLastResult  = null;

/* ===================================================================== */
/*  INIT                                                                   */
/* ===================================================================== */
function initTray() {
  trayAddRow();
}

/* ===================================================================== */
/*  GEOMETRY MODE                                                          */
/* ===================================================================== */
function traySetGeomMode(el, mode) {
  _trayGeomMode = mode;
  el.closest('.seg-group').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tray-rect-inputs').style.display = mode === 'rect' ? '' : 'none';
  document.getElementById('tray-circ-inputs').style.display = mode === 'circ' ? '' : 'none';
}

function traySetConduitType(el, type) {
  _trayConduitType = type;
  el.closest('.seg-group').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tray-round-inputs').style.display = type === 'round' ? '' : 'none';
  document.getElementById('tray-oval-inputs').style.display  = type === 'oval'  ? '' : 'none';
}

function traySetTrayType(el, type) {
  _trayTrayType = type;
  el.closest('.seg-group').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function traySetStandard(el, std) {
  _trayStandard = std;
  el.closest('.seg-group').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

/* ===================================================================== */
/*  CABLE TABLE                                                            */
/* ===================================================================== */
function trayAddRow() {
  const id = _trayNextId++;
  _trayRows.push({ id, mode: 'od', odMode: 'diameter', od: 10, xsec: 2.5, count: 1, type: 'power' });
  _trayRenderRows();
}

function trayDeleteRow(id) {
  _trayRows = _trayRows.filter(r => r.id !== id);
  _trayRenderRows();
}

function traySetRowMode(id, mode) {
  _trayReadRow(id);
  const row = _trayRows.find(r => r.id === id);
  if (!row) return;
  row.mode = mode;
  _trayRenderRows();
}

function trayToggleOdMode(id) {
  _trayReadRow(id);
  const row = _trayRows.find(r => r.id === id);
  if (!row) return;
  row.odMode = row.odMode === 'diameter' ? 'radius' : 'diameter';
  _trayRenderRows();
}

function trayUpdateRow(id) {
  _trayReadRow(id);
  const row = _trayRows.find(r => r.id === id);
  if (!row) return;
  const areaEl = document.getElementById(`tray-area-${id}`);
  if (areaEl) {
    const area = Math.PI * Math.pow(row.od / 2, 2) * row.count;
    areaEl.textContent = area.toFixed(1);
  }
}

function _trayReadRow(id) {
  const row = _trayRows.find(r => r.id === id);
  if (!row) return;
  if (row.mode === 'od') {
    const odEl = document.getElementById(`tray-od-val-${id}`);
    if (odEl) {
      const v = parseFloat(odEl.value) || 0;
      row.od = row.odMode === 'diameter' ? v : v * 2;
    }
  } else {
    const selEl = document.getElementById(`tray-xsec-sel-${id}`);
    if (selEl) {
      row.xsec = parseFloat(selEl.value);
      row.od = TRAY_XSEC_OD[row.xsec] || 10;
    }
  }
  const cntEl  = document.getElementById(`tray-count-${id}`);
  if (cntEl)  row.count = Math.max(1, parseInt(cntEl.value)  || 1);
  const typeEl = document.getElementById(`tray-type-${id}`);
  if (typeEl) row.type = typeEl.value;
}

/* Exposed so setLang() can refresh localised dropdown options */
function trayRenderRows() { _trayRenderRows(); }

function _trayRenderRows() {
  const tbody = document.getElementById('tray-cable-body');
  if (!tbody) return;

  const tLang = (typeof lang !== 'undefined' && T[lang]) ? lang : 'eng';
  const t = T[tLang];

  const TL = {
    power:   t.tray_typePower   || 'Power',
    control: t.tray_typeControl || 'Control',
    fiber:   t.tray_typeFiber   || 'Fiber',
    signal:  t.tray_typeSignal  || 'Signal'
  };
  const modeOD   = t.tray_modeOD   || 'OD';
  const modeXsec = t.tray_modeXsec || 'mm²';
  const warnEst  = t.tray_warnEstOd || 'OD estimated — may vary by manufacturer';

  tbody.innerHTML = '';

  for (const row of _trayRows) {
    const odDisp   = row.odMode === 'diameter' ? row.od : row.od / 2;
    const odUnit   = row.odMode === 'diameter' ? 'mm (⌀)' : 'mm (r)';
    const odToggle = row.odMode === 'diameter' ? '⇄ r' : '⇄ ⌀';
    const area     = Math.PI * Math.pow(row.od / 2, 2) * row.count;

    const xsecOpts = TRAY_XSEC_LIST.map(v =>
      `<option value="${v}"${v === row.xsec ? ' selected' : ''}>${v} mm²</option>`
    ).join('');
    const typeOpts = ['power','control','fiber','signal'].map(tp =>
      `<option value="${tp}"${tp === row.type ? ' selected' : ''}>${TL[tp]}</option>`
    ).join('');

    const INP = `background:var(--surf-2);border:1.5px solid var(--out);border-radius:var(--r-sm);color:var(--on-surf);font-family:'Roboto',sans-serif;font-size:12.5px;padding:5px 8px;outline:none;`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space:nowrap">
        <div class="seg-group" style="margin-bottom:0;min-width:72px">
          <button class="seg-btn${row.mode==='od'?' active':''}" onclick="traySetRowMode(${row.id},'od')" style="padding:4px 6px;font-size:11px">${modeOD}</button>
          <button class="seg-btn${row.mode==='xsec'?' active':''}" onclick="traySetRowMode(${row.id},'xsec')" style="padding:4px 6px;font-size:11px">${modeXsec}</button>
        </div>
      </td>
      <td>
        <div style="display:${row.mode==='od'?'block':'none'}">
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" id="tray-od-val-${row.id}" value="${odDisp.toFixed(1)}" min="0.1" step="0.1" oninput="trayUpdateRow(${row.id})" style="${INP}width:62px">
            <span style="font-size:10px;color:var(--on-surf-var);white-space:nowrap">${odUnit}</span>
          </div>
          <button onclick="trayToggleOdMode(${row.id})" style="margin-top:3px;background:var(--sec-con);color:var(--on-sec-con);border:none;border-radius:var(--r-sm);padding:2px 7px;font-size:10px;cursor:pointer;font-family:'Roboto',sans-serif">${odToggle}</button>
        </div>
        <div style="display:${row.mode==='xsec'?'block':'none'}">
          <select id="tray-xsec-sel-${row.id}" onchange="trayUpdateRow(${row.id})" style="${INP}width:88px">${xsecOpts}</select>
          <div style="font-size:9.5px;color:var(--warn-col);margin-top:3px;line-height:1.35;max-width:115px">${warnEst}</div>
        </div>
      </td>
      <td><input type="number" id="tray-count-${row.id}" value="${row.count}" min="1" step="1" oninput="trayUpdateRow(${row.id})" style="${INP}width:52px"></td>
      <td><select id="tray-type-${row.id}" onchange="trayUpdateRow(${row.id})" style="${INP}min-width:80px">${typeOpts}</select></td>
      <td id="tray-area-${row.id}" style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--pri);white-space:nowrap">${area.toFixed(1)}</td>
      <td><button onclick="trayDeleteRow(${row.id})" class="sb-del-btn" style="padding:3px 8px;font-size:11px">✕</button></td>
    `;
    tbody.appendChild(tr);
  }
}

/* ===================================================================== */
/*  GEOMETRY HELPERS                                                       */
/* ===================================================================== */
function _trayGetUsableArea() {
  if (_trayGeomMode === 'rect') {
    const w = parseFloat(document.getElementById('tray-width').value)  || 0;
    const h = parseFloat(document.getElementById('tray-height').value) || 0;
    return { area: w * h, w, h, valid: w > 0 && h > 0 };
  }
  if (_trayConduitType === 'round') {
    const d = parseFloat(document.getElementById('tray-diameter').value) || 0;
    return { area: Math.PI * Math.pow(d / 2, 2), d, valid: d > 0 };
  }
  const ow = parseFloat(document.getElementById('tray-oval-w').value) || 0;
  const oh = parseFloat(document.getElementById('tray-oval-h').value) || 0;
  return { area: Math.PI * (ow / 2) * (oh / 2), ow, oh, valid: ow > 0 && oh > 0 };
}

/* ===================================================================== */
/*  FILL LIMIT LOGIC                                                       */
/* ===================================================================== */
function _trayGetLimits(totalCount, types) {
  const hasPower = types.has('power');
  const hasOther = types.has('control') || types.has('fiber') || types.has('signal');
  const mixed    = hasPower && hasOther;
  let ruleKey;

  if      (totalCount === 1) ruleKey = 'single';
  else if (totalCount === 2) ruleKey = 'two';
  else if (mixed)            ruleKey = 'mixed';
  else if (hasPower)         ruleKey = 'power';
  else                       ruleKey = 'signal';

  return {
    ruleKey,
    mixed,
    limitIec: TRAY_LIMITS[ruleKey].iec,
    limitNec:  TRAY_LIMITS[ruleKey].nec
  };
}

/* ===================================================================== */
/*  CALCULATE                                                              */
/* ===================================================================== */
function trayCalculate() {
  const errEl = document.getElementById('tray-err');
  errEl.style.display = 'none';

  const tLang = (typeof lang !== 'undefined' && T[lang]) ? lang : 'eng';
  const t = T[tLang];

  /* Sync all rows first */
  for (const row of _trayRows) _trayReadRow(row.id);

  /* Validate geometry */
  const geom = _trayGetUsableArea();
  if (!geom.valid) {
    errEl.textContent = t.tray_errNoTray || 'Please enter valid tray dimensions.';
    errEl.style.display = 'block';
    return;
  }

  /* Validate cables */
  if (_trayRows.length === 0) {
    errEl.textContent = t.tray_errNoCables || 'Please add at least one cable row.';
    errEl.style.display = 'block';
    return;
  }

  /* Accumulate */
  let totalCableArea = 0, totalCount = 0;
  const types    = new Set();
  const odCounts = {};

  for (const row of _trayRows) {
    const singleArea = Math.PI * Math.pow(row.od / 2, 2);
    totalCableArea  += singleArea * row.count;
    totalCount      += row.count;
    types.add(row.type);
    odCounts[row.od] = (odCounts[row.od] || 0) + row.count;
  }

  /* Fill limit */
  const { ruleKey, mixed, limitIec, limitNec } = _trayGetLimits(totalCount, types);
  const activeLimit  = _trayStandard === 'iec' ? limitIec : limitNec;
  const standardName = _trayStandard === 'iec' ? 'IEC 60364-5-52' : 'NEC 392 / 358';
  const ruleDesc     = (TRAY_RULE_DESC[ruleKey] || {})[tLang]
                    || (TRAY_RULE_DESC[ruleKey] || {}).eng
                    || ruleKey;

  /* Fill % and remaining */
  const fillPct   = (totalCableArea / geom.area) * 100;
  const remaining = Math.max(0, geom.area - totalCableArea);

  /* Most common OD by count */
  const mostCommonOd = parseFloat(Object.entries(odCounts).sort((a, b) => b[1] - a[1])[0][0]);
  const commonSingle = Math.PI * Math.pow(mostCommonOd / 2, 2);
  const roomAtLimit  = Math.max(0, (geom.area * activeLimit / 100) - totalCableArea);
  const additional   = Math.floor(roomAtLimit / commonSingle);

  /* Status */
  let statusClass, statusKey;
  if      (fillPct > activeLimit)          { statusClass = 'red';    statusKey = 'tray_statusOver'; }
  else if (fillPct > activeLimit * 0.9)   { statusClass = 'yellow'; statusKey = 'tray_statusWarn'; }
  else                                     { statusClass = 'green';  statusKey = 'tray_statusOk';   }

  /* Stacking check (rectangular only) */
  let stackWarn = false;
  if (_trayGeomMode === 'rect' && geom.w > 0 && geom.h > 0) {
    stackWarn = (totalCableArea / geom.w) > geom.h;
  }

  /* ---- Render results ---- */
  document.getElementById('tray-res-card').style.display = 'block';

  document.getElementById('tray-r-fill-pct').textContent   = fillPct.toFixed(1) + ' %';
  document.getElementById('tray-r-cable-area').textContent = totalCableArea.toFixed(0) + ' mm²';
  document.getElementById('tray-r-tray-area').textContent  = geom.area.toFixed(0) + ' mm²';
  document.getElementById('tray-r-remaining').textContent  = remaining.toFixed(0) + ' mm²';
  document.getElementById('tray-r-additional').textContent = additional + ' × ⌀' + mostCommonOd.toFixed(1) + ' mm';
  document.getElementById('tray-r-limit').textContent      = activeLimit + ' %';
  document.getElementById('tray-r-rule').textContent       = ruleDesc;

  const statusEl = document.getElementById('tray-r-status');
  statusEl.textContent = t[statusKey] || statusKey;
  statusEl.className   = 'sb-status-badge ' + statusClass;

  /* Fill bar */
  const barEl = document.getElementById('tray-fill-bar');
  barEl.style.width      = Math.min(fillPct, 100).toFixed(1) + '%';
  barEl.style.background = statusClass === 'green' ? '#00c864'
                         : statusClass === 'yellow' ? '#c88c00' : '#ff4444';

  /* Limit marker */
  document.getElementById('tray-fill-limit-marker').style.left = Math.min(activeLimit, 100) + '%';

  /* Warnings */
  const stackEl = document.getElementById('tray-stack-warn');
  stackEl.style.display = (stackWarn && _trayGeomMode === 'rect') ? 'flex' : 'none';
  if (stackWarn) stackEl.textContent = t.tray_warnStack || '⚠ Estimated stack height exceeds tray height';

  const mixedEl = document.getElementById('tray-mixed-warn');
  mixedEl.style.display = mixed ? 'flex' : 'none';
  if (mixed) mixedEl.textContent = t.tray_warnMixed || '⚠ Mixed cable types — stricter 40% rule applies';

  /* Rule info line */
  document.getElementById('tray-rule-info').textContent =
    activeLimit + '% — ' + standardName + ' — ' + ruleDesc;

  /* Store for PDF */
  _trayLastResult = {
    fillPct, totalCableArea, trayArea: geom.area, remaining, activeLimit,
    ruleKey, ruleDesc, standardName, statusClass, statusKey,
    additional, mostCommonOd, totalCount, types: [...types],
    stackWarn, mixed, geomMode: _trayGeomMode, trayType: _trayTrayType, geom
  };
}

/* ===================================================================== */
/*  PDF EXPORT                                                             */
/* ===================================================================== */
function trayDownloadPdf() {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  if (!_trayLastResult) { trayCalculate(); }
  if (!_trayLastResult) return;

  const { jsPDF } = window.jspdf;
  const r   = _trayLastResult;
  const tLang = (typeof lang !== 'undefined' && T[lang]) ? lang : 'eng';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297, M = 15, CW = PW - 2 * M;
  const ACC = [126, 205, 233];   // #7ECDE9
  const DIM = [100, 100, 100];

  function pdfSafe(s) {
    return String(s)
      .replace(/∅/g, 'OD').replace(/π/g, 'pi')
      .replace(/²/g, '^2').replace(/×/g, 'x')
      .replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/[^\x00-\xFF]/g, '?');
  }

  /* Header band */
  doc.setFillColor(20, 30, 40);
  doc.rect(0, 0, PW, 26, 'F');
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACC);
  doc.text('Cable Tray / Conduit Fill Calculator', M, 12);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 180, 188);
  doc.text(r.standardName, M, 20);
  doc.text(new Date().toLocaleDateString(), PW - M, 20, { align: 'right' });

  /* Footer */
  function addFooter() {
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.25);
    doc.line(M, PH - M - 6, PW - M, PH - M - 6);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text('IEC 60364-5-52 / NEC 392 / NEC 358', M, PH - M - 2);
    doc.text('Cable Tray Fill Calculator', PW - M, PH - M - 2, { align: 'right' });
  }

  let y = 34;

  function secHdr(title) {
    if (y > PH - M - 30) { doc.addPage(); addFooter(); y = M + 5; }
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACC);
    doc.text(pdfSafe(title.toUpperCase()), M, y);
    doc.setDrawColor(...ACC); doc.setLineWidth(0.25);
    doc.line(M, y + 1.5, M + CW, y + 1.5);
    y += 7; doc.setTextColor(30, 30, 30);
  }

  function kv(label, value) {
    if (y > PH - M - 10) { doc.addPage(); addFooter(); y = M + 5; }
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DIM); doc.text(pdfSafe(label) + ':', M, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...ACC);
    doc.text(pdfSafe(String(value)), M + 70, y);
    y += 5.5; doc.setTextColor(30, 30, 30);
  }

  /* Geometry */
  secHdr('Geometry');
  let geomTypeStr = r.geomMode === 'rect'
    ? r.trayType.charAt(0).toUpperCase() + r.trayType.slice(1) + ' tray'
    : (_trayConduitType === 'round' ? 'Round conduit' : 'Oval duct');
  kv('Type', geomTypeStr);
  if (r.geomMode === 'rect') {
    kv('Dimensions', r.geom.w + ' mm x ' + r.geom.h + ' mm');
  } else if (r.geom.d) {
    kv('Inner diameter', 'OD ' + r.geom.d + ' mm');
  } else {
    kv('Dimensions', r.geom.ow + ' mm x ' + r.geom.oh + ' mm');
  }
  kv('Usable area', r.trayArea.toFixed(0) + ' mm^2');
  y += 2;

  /* Standard */
  secHdr('Standard & Rule');
  kv('Standard',     r.standardName);
  kv('Applied rule', r.ruleDesc);
  kv('Fill limit',   r.activeLimit + ' %');
  y += 2;

  /* Cable table */
  secHdr('Cables');
  const colW = [18, 26, 14, 26, 32, 24];
  const hdrs = ['#', 'OD (mm)', 'Count', 'Type', 'Area (mm^2)', 'Input'];

  /* Table header */
  doc.setFillColor(...ACC);
  doc.rect(M, y, CW, 6.5, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let cx = M;
  hdrs.forEach((h, i) => {
    doc.text(pdfSafe(h), i === 0 ? cx + 2 : cx + colW[i] - 2, y + 4.5,
      i === 0 ? {} : { align: 'right' });
    cx += colW[i];
  });
  y += 6.5;

  _trayRows.forEach((row, ri) => {
    if (y > PH - M - 12) { doc.addPage(); addFooter(); y = M + 5; }
    if (ri % 2 === 1) { doc.setFillColor(245, 248, 252); doc.rect(M, y, CW, 6.5, 'F'); }
    doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.1);
    doc.rect(M, y, CW, 6.5);
    const area  = Math.PI * Math.pow(row.od / 2, 2) * row.count;
    const cells = [ri + 1, 'OD ' + row.od.toFixed(1), row.count,
                   row.type.charAt(0).toUpperCase() + row.type.slice(1),
                   area.toFixed(1), row.mode === 'xsec' ? '[est. OD]' : 'measured'];
    cx = M;
    cells.forEach((cell, i) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.setTextColor(i === 5 && row.mode === 'xsec' ? 180 : 40,
                       i === 5 && row.mode === 'xsec' ? 130 : 40, 40);
      doc.text(pdfSafe(String(cell)), i === 0 ? cx + 2 : cx + colW[i] - 2, y + 4.5,
        i === 0 ? { maxWidth: colW[i] - 3 } : { align: 'right', maxWidth: colW[i] - 3 });
      cx += colW[i];
    });
    y += 6.5;
  });
  y += 4;

  /* Results */
  secHdr('Results');
  kv('Total cable area',   r.totalCableArea.toFixed(0) + ' mm^2');
  kv('Tray usable area',   r.trayArea.toFixed(0) + ' mm^2');
  kv('Fill percentage',    r.fillPct.toFixed(1) + ' %');
  kv('Fill limit',         r.activeLimit + ' %');
  kv('Remaining capacity', r.remaining.toFixed(0) + ' mm^2');
  kv('Additional cables',  r.additional + ' x OD ' + r.mostCommonOd.toFixed(1) + ' mm');
  y += 2;

  /* Status box */
  const statusText = r.fillPct > r.activeLimit ? 'EXCEEDED'
    : r.fillPct > r.activeLimit * 0.9 ? 'WARNING' : 'OK';
  const sCol = r.statusClass === 'green' ? [0, 160, 80]
             : r.statusClass === 'yellow' ? [180, 130, 0] : [200, 40, 40];
  const sBg  = r.statusClass === 'green' ? [220, 255, 235]
             : r.statusClass === 'yellow' ? [255, 248, 220] : [255, 225, 220];
  if (y > PH - M - 20) { doc.addPage(); addFooter(); y = M + 5; }
  doc.setFillColor(...sBg);
  doc.setDrawColor(...sCol);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, CW, 14, 3, 3, 'FD');
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...sCol);
  doc.text(statusText, PW / 2, y + 9.5, { align: 'center' });
  y += 20;

  /* Warnings */
  if (r.stackWarn || r.mixed) {
    secHdr('Warnings');
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 100, 0);
    if (r.stackWarn) {
      doc.text('! Estimated stack height exceeds tray height — consider wider or taller tray', M, y);
      y += 5.5;
    }
    if (r.mixed) {
      doc.text('! Mixed cable types (power + other) detected — stricter 40% fill rule applied', M, y);
      y += 5.5;
    }
    y += 2;
  }

  addFooter();
  doc.save('cable-tray-fill.pdf');
}
