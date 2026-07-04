/* DataMind AI — Frontend Application Logic */
const API = '';
let chatOpen = false;


// ===== UTILITIES =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

// ===== SHADER ANIMATION =====
let shaderAnimationId = null;
let shaderRenderer = null;
let shaderUniforms = null;
let shaderScene = null;
let shaderCamera = null;

function initShader() {
  const container = document.getElementById('shader-bg');
  if (!container || shaderRenderer || !window.THREE) return;

  const vertexShader = `void main() { gl_Position = vec4(position, 1.0); }`;
  const fragmentShader = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    void main(void) {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
      float t = time * 0.05;
      float lineWidth = 0.002;
      vec3 color = vec3(0.0);
      for(int j = 0; j < 3; j++){
        for(int i=0; i < 5; i++){
          color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*5.0 - length(uv) + mod(uv.x+uv.y, 0.2));
        }
      }
      gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
    }
  `;

  shaderCamera = new THREE.Camera();
  shaderCamera.position.z = 1;
  shaderScene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);

  shaderUniforms = {
    time: { type: "f", value: 1.0 },
    resolution: { type: "v2", value: new THREE.Vector2() }
  };

  const material = new THREE.ShaderMaterial({
    uniforms: shaderUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  shaderScene.add(mesh);

  shaderRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  shaderRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(shaderRenderer.domElement);

  const onWindowResize = () => {
    if (!shaderRenderer) return;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    shaderRenderer.setSize(width, height);
    shaderUniforms.resolution.value.x = shaderRenderer.domElement.width;
    shaderUniforms.resolution.value.y = shaderRenderer.domElement.height;
  };

  onWindowResize();
  window.addEventListener("resize", onWindowResize, false);
}

function startShader() {
  if (!window.THREE) return;
  if (!shaderRenderer) initShader();
  
  if (shaderAnimationId) cancelAnimationFrame(shaderAnimationId);
  const animate = () => {
    shaderAnimationId = requestAnimationFrame(animate);
    if (shaderUniforms) shaderUniforms.time.value += 0.05;
    if (shaderRenderer && shaderScene && shaderCamera) shaderRenderer.render(shaderScene, shaderCamera);
  };
  animate();
}

function stopShader() {
  if (shaderAnimationId) {
    cancelAnimationFrame(shaderAnimationId);
    shaderAnimationId = null;
  }
}

function showSpinner(text = 'Processing...', progress = null) {
  $('#spinner-text').textContent = text;
  $('#spinner-overlay').classList.add('active');
  
  const bar = $('#spinner-progress-bar');
  const track = document.querySelector('.spinner-progress-track');
  if (bar && track) {
    if (progress !== null) {
      track.style.display = 'block';
      bar.style.width = progress + '%';
    } else {
      track.style.display = 'none';
      bar.style.width = '0%';
    }
  }
  
  // Small delay to ensure container is visible before starting shader
  setTimeout(startShader, 50);
}

function hideSpinner() { 
  $('#spinner-overlay').classList.remove('active'); 
  const bar = $('#spinner-progress-bar');
  if (bar) bar.style.width = '0%';
  stopShader();
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:0.85rem;z-index:300;animation:msgIn 0.3s ease;font-family:'DM Sans',sans-serif;`;
  t.style.background = type === 'error' ? '#ff6b6b' : type === 'success' ? '#6bcb77' : '#00e5ff';
  t.style.color = '#000'; t.style.fontWeight = '600';
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ===== UPLOAD HANDLING =====
function initUpload() {
  const zone = $('#upload-zone');
  const input = $('#file-input');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files.length) uploadFile(input.files[0]); });
}

// ===== DATA PREVIEW MODAL =====
function showPreviewModal(data, proceedCallback) {
  const overlay = $('#preview-modal-overlay');
  const table = $('#preview-table');
  const stats = $('#preview-stats');
  if (!overlay || !table) {
    proceedCallback();
    return;
  }
  
  stats.innerHTML = `<p style="margin-bottom:8px;color:var(--text-dim);"><strong>Shape:</strong> ${data.rows.toLocaleString()} rows × ${data.columns} columns</p>`;
  
  let thead = '<tr>';
  data.column_names.forEach(c => {
    let dtype = data.dtypes ? data.dtypes[c] : 'unknown';
    thead += `<th>${c}<br><span style="font-size:0.75rem;font-weight:normal;color:var(--text-muted)">${dtype}</span></th>`;
  });
  thead += '</tr>';
  
  let tbody = '';
  if (data.sample && data.sample.length > 0) {
    data.sample.forEach(row => {
      tbody += '<tr>';
      data.column_names.forEach(c => {
        let val = row[c] !== null ? row[c] : '';
        tbody += `<td>${val}</td>`;
      });
      tbody += '</tr>';
    });
  }
  
  table.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
  overlay.style.display = 'flex';
  
  window.confirmPreview = () => {
    overlay.style.display = 'none';
    proceedCallback();
  };
  window.cancelPreview = () => {
    overlay.style.display = 'none';
  };
}

async function uploadFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) { showToast('Please upload a CSV file', 'error'); return; }
  showSpinner('Uploading & parsing CSV...');
  try {
    const data = await DataEngine.loadCSV(file);
    const datasetInfo = { name: file.name, rows: data.length, columns: Object.keys(data[0]||{}).length, column_names: Object.keys(data[0]||{}), sample: data.slice(0,10), dtypes: {} };
    hideSpinner();
    showPreviewModal(datasetInfo, async () => {
      showSpinner('Cleaning data & running EDA...');
      await startAnalysis(datasetInfo);
    });
  } catch (e) {
    console.error(e);
    showToast('Upload failed. The file may be in an unsupported format.', 'error');
    hideSpinner();
  }
}

async function generateDataset(type) {
  showSpinner(`Loading ${type} dataset...`);
  try {
    let filename = type === 'ecommerce' ? 'ecommerce.csv' : 'retail.csv';
    const response = await fetch(`static/${filename}`);
    const text = await response.text();
    const file = new File([text], filename, { type: 'text/csv' });
    await uploadFile(file);
  } catch (e) {
    showToast('Failed to load sample dataset', 'error');
    hideSpinner();
  }
}

// ===== ANALYSIS PIPELINE =====
window.startAnalysis = async function(datasetInfo) {
  document.body.classList.add('app-active');
  
  if (window.innerWidth <= 768) {
    document.getElementById('mobile-nav').style.display = 'flex';
  }
  
  // Clear chat history when a new dataset is loaded — DataMind must never bleed context
  window.chatHistory = [];
  const msgBox = document.getElementById('dm-messages');
  if (msgBox) {
    msgBox.innerHTML = '';
    // Re-add greeting
    const greet = document.createElement('div');
    greet.className = 'dm-msg bot';
    greet.innerHTML = `<div class="dm-msg-icon"><i class="ti ti-robot"></i></div><div class="dm-bubble">Hello! I&apos;m DataMind, your personal AI data analyst — created by Samuel Alex. I&apos;m here to help you understand your data easily, even if you&apos;ve never worked with data before. Upload a CSV or select a sample dataset to get started, and I&apos;ll guide you through everything! &#129504;</div>`;
    msgBox.appendChild(greet);
  }

  // Update UI
  $('#topbar-dataset').textContent = datasetInfo.name;
  $('#topbar-dataset').classList.add('active');
  $('#export-dropdown').style.display = 'block';
  hide($('#landing')); $('#dashboard').classList.add('active');
  $('#app-layout').classList.remove('sidebar-hidden');

  // Update sidebar basic info
  $('#sidebar-rows').textContent = datasetInfo.rows?.toLocaleString() || '—';
  $('#sidebar-cols').textContent = datasetInfo.columns || '—';
  $('#sidebar-name').textContent = datasetInfo.name || '—';

  // Show skeletons
  showChartSkeletons();

  // ── PHASE 1: EDA (must complete first — produces df_clean) ──
  showSpinner('Step 1/3 — Cleaning & analyzing data...', 20);
  await runEDA();

  // Update datasetInfo with inferred dtypes for date filter logic
  datasetInfo.dtypes = DataEngine.dtypes;

  // ── PHASE 2: Charts + KPIs (purely client-side, fast) ──
  showSpinner('Step 2/3 — Generating charts...', 50);
  // Use setTimeout(0) to yield to the browser so the spinner text actually renders
  await new Promise(r => setTimeout(r, 0));
  await Promise.all([
    loadKPIs().catch(e => console.warn('KPIs:', e)),
    loadCharts().catch(e => console.warn('Charts:', e)),
    loadForecast().catch(e => console.warn('Forecast:', e)),
  ]);

  // ── PHASE 3: DONE — Hide spinner immediately ──
  showSpinner('Finalizing...', 100);
  await new Promise(r => setTimeout(r, 300));
  hideSpinner();

  // Set up date filters from the cleaned data
  let dateCols = Object.keys(DataEngine.dtypes).filter(c => DataEngine.dtypes[c] === 'datetime');
  if (dateCols.length > 0 && DataEngine.clean_data.length > 0) {
    try {
      let dates = DataEngine.clean_data.map(r => new Date(r[dateCols[0]])).filter(d => !isNaN(d));
      if (dates.length > 0) {
        let minD = new Date(Math.min(...dates));
        let maxD = new Date(Math.max(...dates));
        
        let uniqueMonths = new Set();
        dates.forEach(d => uniqueMonths.add(d.toISOString().substring(0, 7)));
        let sortedMonths = Array.from(uniqueMonths).sort();
        
        const wrapper = $('#date-inputs-wrapper');
        
        if (sortedMonths.length <= 36 && sortedMonths.length > 1) {
          // Use Dropdowns for manageable month ranges
          let optionsHtml = sortedMonths.map(m => `<option value="${m}">${m}</option>`).join('');
          wrapper.innerHTML = `
            <select id="date-from" class="date-input" title="Start Month" style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--bg); color:var(--text);">
              <option value="">Any</option>
              ${optionsHtml}
            </select>
            <span style="color: var(--text-dim);">to</span>
            <select id="date-to" class="date-input" title="End Month" style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--bg); color:var(--text);">
              <option value="">Any</option>
              ${optionsHtml}
            </select>
          `;
          
          $('#date-from').addEventListener('change', function() {
            let startVal = this.value;
            let endSelect = $('#date-to');
            let currentEnd = endSelect.value;
            
            let validMonths = startVal ? sortedMonths.filter(m => m >= startVal) : sortedMonths;
            let newOptions = '<option value="">Any</option>' + validMonths.map(m => `<option value="${m}">${m}</option>`).join('');
            endSelect.innerHTML = newOptions;
            
            if (currentEnd && currentEnd < startVal) {
               endSelect.value = validMonths[validMonths.length - 1]; // Reset to last available
            } else if (currentEnd && validMonths.includes(currentEnd)) {
               endSelect.value = currentEnd;
            }
          });
          
        } else {
          // Use constrained HTML5 Date Inputs for dense data
          let minStr = minD.toISOString().split('T')[0];
          let maxStr = maxD.toISOString().split('T')[0];
          wrapper.innerHTML = `
            <input type="date" id="date-from" class="date-input" title="Start Date" min="${minStr}" max="${maxStr}">
            <span style="color: var(--text-dim);">to</span>
            <input type="date" id="date-to" class="date-input" title="End Date" min="${minStr}" max="${maxStr}">
          `;
        }
      }
    } catch(e) { console.warn('Date filter setup error', e); }
    const filters = $('#date-filters-container');
    if (filters) filters.style.display = 'flex';
  } else {
    const filters = $('#date-filters-container');
    if (filters) filters.style.display = 'none';
  }

  // ── Data Quality Score ──
  try {
    const eda = DataEngine.eda_results;
    const totalCells = (eda.shape?.rows || 1) * (eda.shape?.columns || 1);
    const completeness = totalCells > 0 ? Math.round(Math.max(0, 100 - (eda.missing_values?.total_before || 0) / totalCells * 100) * 10) / 10 : 100;
    const uniqueness = eda.duplicates?.rows_before > 0 ? Math.round((eda.duplicates.rows_after / eda.duplicates.rows_before) * 1000) / 10 : 100;
    const outlierHealth = Math.round(Math.max(0, 100 - ((eda.total_unique_outlier_rows || 0) / (eda.duplicates?.rows_after || 1) * 100)) * 10) / 10;
    const qualityScore = Math.round((completeness * 0.4 + uniqueness * 0.3 + outlierHealth * 0.3) * 10) / 10;
    updateQualityGauge(qualityScore, { completeness, uniqueness, outlier_health: outlierHealth });
  } catch(e) { console.warn('Quality gauge:', e); }
  
  showToast('✓ Dataset cleaned & charts ready', 'success');

  // ── BACKGROUND: AI Insights + Recommendations (non-blocking) ──
  // These make network calls to the AI API and should NOT block the dashboard
  Promise.all([
    loadInsights().catch(e => console.warn('Insights:', e)),
    loadRecommendations().catch(e => console.warn('Recommendations:', e)),
    setupWhatIf().catch(e => console.warn('What-If:', e)),
  ]);
}

// ===== DATE FILTERS =====
window.resetDateFilters = async () => {
  if ($('#date-from')) $('#date-from').value = '';
  if ($('#date-to')) $('#date-to').value = '';
  loadCharts();
  loadKPIs();
};

window.applyDateFilters = async () => {
  const dFrom = $('#date-from').value;
  const dTo = $('#date-to').value;
  if (!dFrom && !dTo) return resetDateFilters();
  
  const chartsGrid = $('#charts-grid');
  if (chartsGrid) chartsGrid.innerHTML = '<div style="color:var(--text-dim);grid-column:1/-1;">Re-generating charts...</div>';
  
  let dateCols = Object.keys(DataEngine.dtypes).filter(c => DataEngine.dtypes[c] === 'datetime');
  if (dateCols.length === 0) return;
  let dCol = dateCols[0];
  
  let startD = null;
  if (dFrom) {
     startD = new Date(dFrom);
  }
  
  let endD = null;
  if (dTo) {
     if (dTo.length === 7) { // YYYY-MM
       endD = new Date(dTo + "-01T00:00:00Z");
       endD.setUTCMonth(endD.getUTCMonth() + 1);
       endD = new Date(endD.getTime() - 1);
     } else {
       endD = new Date(dTo + "T00:00:00Z");
       endD.setUTCHours(23, 59, 59, 999);
     }
  }

  let filtered = DataEngine.clean_data.filter(row => {
    let d = new Date(row[dCol]);
    if (isNaN(d)) return false;
    if (startD && d < startD) return false;
    if (endD && d > endD) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    if (chartsGrid) chartsGrid.innerHTML = '<div style="color:var(--text-dim);grid-column:1/-1;">No data available for this date range.</div>';
    return;
  }
  
  loadCharts(filtered);
};

async function runEDA() {
  $('#sidebar-eda').innerHTML = '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>';
  try {
    const results = DataEngine.runEDA();
    renderEDA(results);
  } catch (e) { console.error('EDA error:', e); }
}

function renderEDA(r) {
  let html = '';
  // Shape
  html += `<div class="eda-item"><span class="label">Rows (cleaned)</span><span class="value">${r.duplicates?.rows_after?.toLocaleString() || r.shape?.rows}</span></div>`;
  html += `<div class="eda-item"><span class="label">Columns</span><span class="value">${r.shape?.columns}</span></div>`;
  html += `<div class="eda-item"><span class="label">Memory</span><span class="value">${r.shape?.memory_usage_mb} MB</span></div>`;

  // Missing values
  const mb = r.missing_values?.total_before || 0;
  const ma = r.missing_values?.total_after || 0;
  html += `<div class="eda-item"><span class="label">Missing (before)</span><span class="eda-badge ${mb > 0 ? 'warning' : 'success'}">${mb}</span></div>`;
  html += `<div class="eda-item"><span class="label">Missing (after)</span><span class="eda-badge ${ma > 0 ? 'danger' : 'success'}">${ma}</span></div>`;

  // Duplicates
  html += `<div class="eda-item"><span class="label">Duplicates removed</span><span class="eda-badge ${r.duplicates?.removed > 0 ? 'warning' : 'success'}">${r.duplicates?.removed || 0}</span></div>`;

  // Outliers
  const totalOutliers = r.total_unique_outlier_rows || 0;
  html += `<div class="eda-item"><span class="label">Outliers flagged</span><span class="eda-badge warning">${totalOutliers}</span></div>`;

  // Type fixes
  if (r.type_fixes?.length) {
    html += `<div class="eda-item"><span class="label">Type fixes</span><span class="value">${r.type_fixes.length}</span></div>`;
  }

  // Normalised columns
  if (r.capitalisation?.normalised_columns?.length) {
    html += `<div class="eda-item"><span class="label">Text normalised</span><span class="value">${r.capitalisation.normalised_columns.length} cols</span></div>`;
  }

  $('#sidebar-eda').innerHTML = html;

  // Summary stats in sidebar
  let statsHtml = '';
  const stats = r.summary_stats || {};
  for (const [col, s] of Object.entries(stats).slice(0, 6)) {
    statsHtml += `<div class="eda-item"><span class="label">${col}</span><span class="value">${s.mean?.toLocaleString(undefined,{maximumFractionDigits:1})} avg</span></div>`;
  }
  $('#sidebar-stats').innerHTML = statsHtml || '<p style="color:var(--text-dim);font-size:0.8rem;">No numeric columns</p>';

  // Missing value strategies
  const strategies = r.missing_values?.strategies || {};
  const existing = $('#sidebar-strategies');
  if (existing) {
    if (Object.keys(strategies).length === 0) {
      existing.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;padding:8px 0;">No missing values detected</p>';
    } else {
      let stratHtml = '';
      for (const [col, strat] of Object.entries(strategies).slice(0, 8)) {
        stratHtml += `<div class="eda-item"><span class="label">${col}</span><span class="value" style="font-size:0.75rem">${strat}</span></div>`;
      }
      existing.innerHTML = stratHtml;
    }
  }
}

// ===== CHARTS =====
function showChartSkeletons() {
  const grid = $('#charts-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    grid.innerHTML += `<div class="chart-card"><div class="skeleton skeleton-chart"></div><div style="padding:16px"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div></div>`;
  }
}

async function loadCharts(customData = null) {
  let df = customData || DataEngine.clean_data;
  try {
    let charts = [];
    let allCols = Object.keys(DataEngine.dtypes);
    let numCols  = allCols.filter(c => DataEngine.dtypes[c] === 'numeric');
    let catCols  = allCols.filter(c => DataEngine.dtypes[c] === 'object');
    let dateCols = allCols.filter(c => DataEngine.dtypes[c] === 'datetime');

    // ── Analyze Cardinality & Date Spans ──
    let catUniques = {};
    let safeCatCols = [];
    let idCols = [];
    
    catCols.forEach(c => {
      let seen = new Set();
      for (let i = 0; i < Math.min(df.length, 500); i++) {
        let v = df[i][c];
        if (v !== null && v !== undefined && v !== '') seen.add(v);
      }
      let uniq = seen.size;
      catUniques[c] = uniq;
      if (uniq > 0 && uniq / Math.min(df.length, 500) > 0.8) {
        idCols.push(c);
      } else {
        safeCatCols.push(c);
      }
    });

    safeCatCols.sort((a, b) => catUniques[a] - catUniques[b]);

    let custCol = idCols.length > 0 ? idCols[0] : null;
    let productCol = safeCatCols.length > 0 ? safeCatCols[safeCatCols.length - 1] : null;

    // ── Analyze Correlation ──
    let highlyCorrelatedPairs = [];
    if (numCols.length >= 2) {
      for (let i = 0; i < numCols.length; i++) {
        for (let j = i + 1; j < numCols.length; j++) {
          let arr1 = ChartsEngine.numVals(df, numCols[i]);
          let arr2 = ChartsEngine.numVals(df, numCols[j]);
          let minLen = Math.min(arr1.length, arr2.length);
          let pearson = ChartsEngine.pearson(arr1.slice(0, minLen), arr2.slice(0, minLen));
          if (Math.abs(pearson) > 0.3) highlyCorrelatedPairs.push([numCols[i], numCols[j]]);
        }
      }
    }

    function safeAdd(chartFunc) { 
      try {
        let result = chartFunc();
        if (result) charts.push(result); 
      } catch (e) {
        console.warn('Chart generation failed, skipping:', e);
      }
    }

    // 1. Bar Chart
    for (let ci = 0; ci < Math.min(safeCatCols.length, 2); ci++) {
      for (let ni = 0; ni < Math.min(numCols.length, 2); ni++) {
        safeAdd(() => ChartsEngine.barChart(df, safeCatCols[ci], numCols[ni]));
      }
    }

    // 2. Pie / Doughnut Chart
    let pieCat = safeCatCols.find(c => catUniques[c] >= 2 && catUniques[c] <= 7);
    if (pieCat && numCols.length > 0) {
      safeAdd(() => ChartsEngine.doughnutChart(df, pieCat, numCols[0]));
    }

    // 3. Line Chart / Seasonal Heatmap
    if (dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.lineChart(df, dateCols[0], numCols[0]));
      safeAdd(() => ChartsEngine.seasonalHeatmap(df, dateCols[0], numCols[0]));
    }

    // 4. Grouped / Stacked Bar
    if (safeCatCols.length >= 2 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.groupedBar(df, safeCatCols[0], safeCatCols[1], numCols[0]));
      safeAdd(() => ChartsEngine.stackedBar(df, safeCatCols[0], safeCatCols[1], numCols[0]));
    }

    // 5. Pareto / Treemap
    if (safeCatCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.paretoChart(df, safeCatCols[0], numCols[0]));
      safeAdd(() => ChartsEngine.treemapChart(df, safeCatCols[0], numCols[0]));
    }

    // 6. Double Axis / Waterfall
    if (dateCols.length > 0 && numCols.length >= 2) {
      safeAdd(() => ChartsEngine.doubleAxisChart(df, dateCols[0], numCols[0], numCols[1]));
    }
    if (dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.waterfallChart(df, dateCols[0], numCols[0]));
    }

    // 7. Heatmap Corr
    if (numCols.length >= 2 && highlyCorrelatedPairs.length > 0) {
      safeAdd(() => ChartsEngine.heatmapCorr(df, numCols));
    }

    // 8. Scatter Chart
    if (highlyCorrelatedPairs.length > 0) {
      safeAdd(() => ChartsEngine.scatterChart(df, highlyCorrelatedPairs[0][0], highlyCorrelatedPairs[0][1]));
    }

    // 9. Histogram / Box Plot
    if (numCols.length > 0) {
      safeAdd(() => ChartsEngine.histogram(df, numCols[0]));
      safeAdd(() => ChartsEngine.boxPlot(df, [numCols[0]]));
    }

    // 10. Sunburst
    if (safeCatCols.length >= 2 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.sunburstChart(df, safeCatCols[0], safeCatCols[1], numCols[0]));
    }

    // 11. Market Basket
    if (custCol && productCol) {
      safeAdd(() => ChartsEngine.marketBasketChart(df, custCol, productCol));
    }

    // 12. RFM / Cohort / BCG
    if (custCol && dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.rfmChart(df, custCol, dateCols[0], numCols[0]));
      safeAdd(() => ChartsEngine.cohortRetention(df, custCol, dateCols[0]));
    }
    if (productCol && dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.bcgMatrix(df, productCol, numCols[0], dateCols[0]));
    }

    charts = charts.slice(0, 15);
    renderCharts(charts);
  } catch (e) { console.error('Charts error:', e); showToast('Charts failed to load', 'error'); }
}

function renderCharts(charts) {
  const grid = $('#charts-grid');
  grid.innerHTML = '';
  if (!charts?.length) {
    grid.innerHTML = '<p style="color:var(--text-dim);grid-column:span 2;text-align:center;padding:40px;">No charts could be generated.</p>';
    return;
  }

  const existingSearch = document.querySelector('.chart-search-bar');
  if (existingSearch) existingSearch.remove();

  const searchBar = document.createElement('div');
  searchBar.className = 'chart-search-bar';
  searchBar.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="chart-search" placeholder="Search charts..." oninput="filterCharts(this.value)">
    <span class="chart-count" id="chart-count">${charts.length} charts</span>`;
  grid.parentNode.insertBefore(searchBar, grid);

  window._allCharts = charts;

  charts.forEach((chart, i) => {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.style.animation = `fadeSlideUp 0.5s ${0.08 * i}s both`;
    card.dataset.title = (chart.title || '').toLowerCase();
    card.dataset.type = (chart.chart_type || '').toLowerCase();
    const chartDivId = `chart-${i}`;
    card.innerHTML = `
      <div class="chart-card-body" style="padding:0">
        <div id="${chartDivId}" style="width:100%;height:380px;"></div>
        <div style="padding:12px 16px 16px">
          <div class="chart-card-title">
            <span>${chart.title}</span>
            <div class="chart-actions">
              <button class="chart-action-btn" onclick="downloadChartPNG('${chartDivId}', '${(chart.title || 'chart').replace(/'/g, '')}')" title="Download PNG">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="chart-action-btn" onclick="expandPlotlyChart('${chartDivId}')" title="Fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
              </button>
            </div>
          </div>
          <p class="chart-card-caption">${chart.caption || chart.description || ''}</p>
        </div>
      </div>
      <div class="chart-insight-box" id="insight-${chartDivId}" style="border-top: 1px solid var(--border); padding: 12px 16px; background: rgba(0, 229, 255, 0.03); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
        <div class="skeleton-text"></div>
        <div class="skeleton-text" style="width: 60%"></div>
      </div>`;
    grid.appendChild(card);

    if (chart.plotly_json) {
      const config = {
        responsive: true, displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: { format: 'png', filename: chart.title || 'datamind_chart', scale: 2 },
        modeBarButtonsToAdd: [{
          name: 'Fullscreen',
          icon: { width: 24, height: 24, path: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3', transform: 'matrix(1 0 0 1 0 0)' },
          click: function(gd) { expandPlotlyChart(gd.id); }
        }]
      };
      Plotly.newPlot(chartDivId, chart.plotly_json.data, chart.plotly_json.layout, config).then(() => {
        generateChartInsight(chart, chartDivId);
      });
    }
  });
}

async function generateChartInsight(chart, chartDivId) {
  const box = document.getElementById(`insight-${chartDivId}`);
  if (!box) return;
  
  let condensedData = [];
  if (chart.plotly_json && chart.plotly_json.data) {
    chart.plotly_json.data.forEach(trace => {
      let t = { name: trace.name || 'Data', type: trace.type };
      if (trace.x && trace.y) {
        let zipped = trace.x.map((x, i) => ({ x: x, y: trace.y[i] }));
        if (typeof zipped[0]?.y === 'number') zipped.sort((a,b) => b.y - a.y);
        t.top_values = zipped.slice(0, 5);
      } else if (trace.labels && trace.values) {
        let zipped = trace.labels.map((l, i) => ({ label: l, value: trace.values[i] }));
        if (typeof zipped[0]?.value === 'number') zipped.sort((a,b) => b.value - a.value);
        t.top_values = zipped.slice(0, 5);
      }
      condensedData.push(t);
    });
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Chart Title: ${chart.title}\nChart Type: ${chart.chart_type}\nTop Data Points:\n${JSON.stringify(condensedData, null, 2)}`
        }],
        dataset_summary: DataEngine.eda_results,
        action: 'chart_insight'
      })
    });
    
    if (!response.ok) throw new Error('API failed');
    const data = await response.json();
    box.innerHTML = `<p style="margin:0; font-size: 0.9rem; color: var(--text); line-height: 1.5;"><strong>Insight:</strong> ${data.response}</p>`;
  } catch (err) {
    let fallbackText = "This chart visualises key patterns in the dataset. ";
    try {
       if (condensedData[0] && condensedData[0].top_values && condensedData[0].top_values[0]) {
           let top = condensedData[0].top_values[0];
           fallbackText = `The highest recorded value is for ${top.x || top.label} at ${top.y || top.value}.`;
       }
    } catch(e){}
    box.innerHTML = `<p style="margin:0; font-size: 0.9rem; color: var(--text-dim); line-height: 1.5;">${fallbackText}</p>`;
  }
}

function downloadChartPNG(divId, title) {
  const gd = document.getElementById(divId);
  if (!gd) return;
  Plotly.downloadImage(gd, { format: 'png', width: 1200, height: 700, scale: 2, filename: title || 'chart' });
  showToast('Downloading chart as PNG...', 'success');
}

function filterCharts(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll('.chart-card');
  let visible = 0;
  cards.forEach(card => {
    const match = !q || card.dataset.title?.includes(q) || card.dataset.type?.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const counter = document.getElementById('chart-count');
  if (counter) counter.textContent = `${visible} of ${cards.length} charts`;
}

function expandPlotlyChart(divId) {
  const sourceDiv = document.getElementById(divId);
  if (!sourceDiv) return;
  $('#modal-img').style.display = 'none';
  let modalPlotDiv = document.getElementById('modal-plot-div');
  if (!modalPlotDiv) {
    modalPlotDiv = document.createElement('div');
    modalPlotDiv.id = 'modal-plot-div';
    modalPlotDiv.style.cssText = 'width:90vw;height:80vh;';
    $('#modal-overlay .modal-content').appendChild(modalPlotDiv);
  }
  modalPlotDiv.style.display = 'block';
  const data = sourceDiv.data;
  const layout = Object.assign({}, sourceDiv.layout, {
    width: window.innerWidth * 0.88,
    height: window.innerHeight * 0.78
  });
  Plotly.newPlot('modal-plot-div', data, layout, { responsive: true });
  $('#modal-overlay').classList.add('active');
  const popup = document.getElementById('dm-chat-popup');
  if (popup) popup.style.zIndex = '0';
}

function closeModal() {
  $('#modal-overlay').classList.remove('active');
  const mp = document.getElementById('modal-plot-div');
  if (mp) mp.style.display = 'none';
  $('#modal-img').style.display = '';
  const popup = document.getElementById('dm-chat-popup');
  if (popup) popup.style.zIndex = '999';
}

function openImageModal(src) {
  const mp = document.getElementById('modal-plot-div');
  if (mp) mp.style.display = 'none';
  const img = $('#modal-img');
  img.src = src;
  img.style.display = 'block';
  $('#modal-overlay').classList.add('active');
  const popup = document.getElementById('dm-chat-popup');
  if (popup) popup.style.zIndex = '0';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = $('#modal-overlay');
    if (overlay && overlay.classList.contains('active')) {
      closeModal();
    }
  }
});

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
  const overlay = $('#modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
});

// ===== FORECAST =====
async function loadKPIs() {
  const row = document.getElementById('kpi-row');
  if (!row) return;
  const df = DataEngine.clean_data;
  if (!df || df.length === 0) return;
  
  let totalRows = df.length;
  let numericCols = Object.keys(DataEngine.dtypes).filter(c => DataEngine.dtypes[c] === 'numeric');
  
  let html = `<div class="kpi-card" style="animation: fadeSlideUp 0.5s ease both;"><h3>Total Records</h3><div class="kpi-value">${totalRows.toLocaleString()}</div></div>`;
  
  // Add up to 3 numeric aggregations
  for (let i = 0; i < Math.min(numericCols.length, 3); i++) {
    let col = numericCols[i];
    let sum = 0;
    for (let r of df) {
      let v = Number(r[col]);
      if (!isNaN(v)) sum += v;
    }
    html += `<div class="kpi-card" style="animation: fadeSlideUp 0.5s ${0.1 * (i+1)}s ease both;"><h3>Total ${col}</h3><div class="kpi-value">${sum.toLocaleString(undefined, {maximumFractionDigits: 1})}</div></div>`;
  }
  
  row.innerHTML = html;
}

async function loadForecast() {
  const panel = $('#forecast-panel');
  if (!panel) return;
  const df = DataEngine.clean_data;
  const dtypes = DataEngine.dtypes;
  
  let dateCols = Object.keys(dtypes).filter(c => dtypes[c] === 'datetime');
  let numCols = Object.keys(dtypes).filter(c => dtypes[c] === 'numeric');
  
  if (dateCols.length === 0 || numCols.length === 0 || df.length < 10) {
    panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Forecast</h2></div><p style="color:var(--text-dim);padding:20px;">Not enough time-series data to generate a forecast.</p>`;
    return;
  }
  
  const dateCol = dateCols[0];
  const numCol = numCols[0];
  
  panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Forecast</h2></div><p style="color:var(--text-dim);padding:10px 20px;">Generating projection...</p>`;

  // 1. Aggregate by month
  let monthly = {};
  df.forEach(row => {
    let dateStr = String(row[dateCol]);
    let dateObj = new Date(dateStr);
    if (isNaN(dateObj)) return;
    let monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    let val = Number(row[numCol]);
    if (!isNaN(val)) {
      if (!monthly[monthKey]) monthly[monthKey] = 0;
      monthly[monthKey] += val;
    }
  });

  let sortedMonths = Object.keys(monthly).sort();
  if (sortedMonths.length < 3) {
    panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Forecast</h2></div><p style="color:var(--text-dim);padding:20px;">Need at least 3 months of data to forecast.</p>`;
    return;
  }

  // 2. Linear Regression over last 12 months
  let recentMonths = sortedMonths.slice(-12);
  let xSum = 0, ySum = 0, xxSum = 0, xySum = 0;
  let n = recentMonths.length;
  
  recentMonths.forEach((m, i) => {
    let x = i;
    let y = monthly[m];
    xSum += x;
    ySum += y;
    xxSum += x * x;
    xySum += x * y;
  });
  
  let slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
  let intercept = (ySum - slope * xSum) / n;

  // 3. Project next 6 months
  let lastDateStr = sortedMonths[sortedMonths.length - 1];
  let [lastYear, lastMonth] = lastDateStr.split('-').map(Number);
  
  let forecastDates = [];
  let forecastValues = [];
  let lowerBound = [];
  let upperBound = [];
  
  for (let i = 1; i <= 6; i++) {
    lastMonth++;
    if (lastMonth > 12) {
      lastMonth = 1;
      lastYear++;
    }
    let mKey = `${lastYear}-${String(lastMonth).padStart(2, '0')}`;
    forecastDates.push(mKey);
    
    let projectedY = intercept + slope * (n - 1 + i);
    let prevYearMKey = `${lastYear - 1}-${String(lastMonth).padStart(2, '0')}`;
    if (monthly[prevYearMKey]) {
      let prevYrAvg = ySum / n;
      let ratio = monthly[prevYearMKey] / prevYrAvg;
      ratio = 1 + ((ratio - 1) * 0.5); 
      projectedY *= ratio;
    }
    
    projectedY = Math.max(0, projectedY);
    
    forecastValues.push(projectedY);
    lowerBound.push(projectedY * 0.85); // -15% CI
    upperBound.push(projectedY * 1.15); // +15% CI
  }

  // 4. Render chart
  let traceActual = {
    x: sortedMonths,
    y: sortedMonths.map(m => monthly[m]),
    name: 'Actual',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#00d2ff', width: 3 },
    marker: { size: 6 }
  };
  
  let combinedForecastX = [sortedMonths[sortedMonths.length - 1], ...forecastDates];
  let combinedForecastY = [monthly[sortedMonths[sortedMonths.length - 1]], ...forecastValues];
  let combinedLower = [monthly[sortedMonths[sortedMonths.length - 1]], ...lowerBound];
  let combinedUpper = [monthly[sortedMonths[sortedMonths.length - 1]], ...upperBound];
  
  let traceForecast = {
    x: combinedForecastX,
    y: combinedForecastY,
    name: 'Forecast',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#ff3366', width: 3, dash: 'dash' },
    marker: { size: 6 }
  };
  
  let traceUpper = {
    x: combinedForecastX,
    y: combinedUpper,
    type: 'scatter',
    mode: 'lines',
    line: { width: 0 },
    showlegend: false,
    hoverinfo: 'skip'
  };
  
  let traceLower = {
    x: combinedForecastX,
    y: combinedLower,
    type: 'scatter',
    mode: 'lines',
    fill: 'tonexty',
    fillcolor: 'rgba(255, 51, 102, 0.2)',
    line: { width: 0 },
    name: '95% Confidence',
    hoverinfo: 'skip'
  };

  let layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: 'var(--text-dim)' },
    title: { text: `6-Month Forecast: ${numCol}`, font: { color: 'var(--text)', size: 16 } },
    xaxis: { gridcolor: 'var(--border)', title: 'Month' },
    yaxis: { gridcolor: 'var(--border)', title: numCol },
    margin: { l: 50, r: 20, t: 40, b: 40 },
    legend: { orientation: 'h', y: -0.2 }
  };

  panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Forecast</h2></div>
    <div id="forecast-plotly" style="width:100%;height:350px;"></div>
    <div id="forecast-insight" class="insight-item" style="margin-top:15px;display:none;"><span></span></div>`;

  Plotly.newPlot('forecast-plotly', [traceUpper, traceLower, traceActual, traceForecast], layout, { responsive: true, displaylogo: false });

  // 5. Generate commentary
  let trend = slope > 0 ? "projected to grow" : "projected to decline";
  let percentChange = (slope / (ySum / n)) * 100 * 6; // rough 6-mo % change
  let commentary = `Based on historical trends, ${numCol} is ${trend} over the next 6 months, accounting for recent momentum.`;
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{role: 'user', content: `Generate a single short sentence explaining this forecast projection: The target metric ${numCol} has a historical 6-month slope of ${slope.toFixed(2)}, projecting a ${percentChange.toFixed(1)}% change over the next 6 months.`}], 
        dataset_summary: DataEngine.eda_results 
      })
    });
    const data = await res.json();
    if (data.response) commentary = data.response;
  } catch(e) {}
  
  const insightDiv = document.getElementById('forecast-insight');
  if (insightDiv) {
    insightDiv.style.display = 'flex';
    insightDiv.querySelector('span').textContent = commentary;
  }
}

// ===== INSIGHTS =====
async function loadInsights(retryCount = 0) {
  const panel = $('#insights-panel');
  if (retryCount === 0) {
    panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> Key Insights</h2></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:80%"></div><div class="skeleton skeleton-text" style="width:60%"></div>`;
  }

  try {
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{role: 'user', content: 'Generate key insights.'}], 
        dataset_summary: DataEngine.eda_results,
        action: 'key_insights'
      })
    });
    
    if (!res.ok) throw new Error('API Response not ok');
    const data = await res.json();
    
    if (data.response) {
      let lines = data.response.split('\n').filter(l => l.trim().length > 0);
      let html = `<div class="section-header"><h2>Key Insights</h2></div><ul style="padding-left: 20px; color: var(--text); font-size: 0.95rem; line-height: 1.6;">`;
      lines.forEach(line => {
        let cleanLine = line.replace(/^[\-\*\•]\s*/, '').replace(/<\/?strong>/g, '').trim();
        if (cleanLine.length > 5) html += `<li style="margin-bottom: 8px;">${cleanLine}</li>`;
      });
      html += `</ul>`;
      panel.innerHTML = html;
      return;
    }
    throw new Error('No response content');
  } catch (e) {
    if (retryCount < 1) {
      console.warn('Key Insights failed. Retrying in 3 seconds...');
      setTimeout(() => loadInsights(1), 3000);
    } else {
      panel.innerHTML = `<div class="section-header"><h2>Key Insights</h2></div><p style="color: var(--text-dim); padding: 12px;">Unable to generate key insights at this time. The data may be too sparse or the AI API may be unreachable.</p>`;
    }
  }
}

// ===== WHAT-IF (first definition removed — FIX 2) =====

// ── Chat Widget ──────────────────────────────────────────
(function () {
  const fab       = document.getElementById('dm-chat-fab');
  const popup     = document.getElementById('dm-chat-popup');
  const closeBtn  = document.getElementById('dm-close-btn');
  const input     = document.getElementById('dm-input');
  const sendBtn   = document.getElementById('dm-send-btn');
  const msgBox    = document.getElementById('dm-messages');
  const sugsEl    = document.getElementById('dm-suggestions');

  if(!fab || !popup) return;

  let isOpen = false;

  // Initial greeting
  addMsg("Hello! I'm DataMind, your personal AI data analyst — created by Samuel Alex. I'm here to help you understand your data easily, even if you've never worked with data before. Upload a CSV or select a sample dataset to get started, and I'll guide you through everything! \u{1F9E0}", 'bot');

  function toggleChat() {
    isOpen = !isOpen;
    popup.classList.toggle('open', isOpen);
    fab.querySelector('i').className = isOpen ? 'ti ti-x' : 'ti ti-message-chatbot';
    if (isOpen) input.focus();
  }

  fab.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  function addMsg(text, role) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-msg ' + role;
    
    // Convert newlines to breaks
    const sanitised = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
      
    if (role === 'bot') {
      wrap.innerHTML = `<div class="dm-msg-icon"><i class="ti ti-robot"></i></div>
                        <div class="dm-bubble">${sanitised}</div>`;
    } else {
      wrap.innerHTML = `<div class="dm-bubble">${sanitised}</div>`;
    }
    msgBox.appendChild(wrap);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  
  function addBotChart(chartImg) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-msg bot';
    wrap.innerHTML = `<div class="dm-msg-icon"><i class="ti ti-robot"></i></div>
                      <div class="dm-bubble" style="padding:4px"><img src="data:image/png;base64,${chartImg}" style="width:100%;border-radius:8px;display:block;cursor:pointer;" alt="Chart" onclick="openImageModal(this.src)"></div>`;
    msgBox.appendChild(wrap);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  
  function addBotPlotly(plotlyData) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-msg bot';
    const chartId = 'chat-chart-' + Date.now();
    wrap.innerHTML = `<div class="dm-msg-icon"><i class="ti ti-robot"></i></div>
                      <div class="dm-bubble" style="padding:4px; position:relative;">
                        <div id="${chartId}" style="width:200px;height:200px;border-radius:8px;overflow:hidden;background:#fff"></div>
                        <button onclick="expandPlotlyChart('${chartId}')" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.65); color:#fff; border:none; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.2);" title="Fullscreen Chart">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                      </div>`;
    msgBox.appendChild(wrap);
    setTimeout(() => {
      Plotly.newPlot(chartId, plotlyData.data, 
        Object.assign({}, plotlyData.layout, {height: 200, width: 200, margin: {l:20,r:10,t:20,b:20}}),
        {responsive: true, displaylogo: false, displayModeBar: false});
      msgBox.scrollTop = msgBox.scrollHeight;
    }, 50);
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'dm-msg bot'; t.id = 'dm-typing';
    t.innerHTML = `<div class="dm-msg-icon"><i class="ti ti-robot"></i></div>
                   <div class="dm-bubble"><div class="dm-typing">
                     <span></span><span></span><span></span>
                   </div></div>`;
    msgBox.appendChild(t);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('dm-typing');
    if (t) t.remove();
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    addMsg(text, 'user');
    input.value = '';
    sugsEl.style.display = 'none';
    showTyping();

    try {
      window.chatHistory = window.chatHistory || [];
      window.chatHistory.push({ role: 'user', content: text });
      
      const res = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: window.chatHistory, dataset_summary: DataEngine.eda_results })
      });
      const data = await res.json();
      
      if (data.response) {
         window.chatHistory.push({ role: 'assistant', content: data.response });
         data.success = true;
         data.answer = data.response;
      }
      removeTyping();
      
      if (data.success) {
        addMsg(data.answer, 'bot');
        if (data.chart?.plotly_json) {
           addBotPlotly(data.chart.plotly_json);
        } else if (data.chart?.image_base64) {
           addBotChart(data.chart.image_base64);
        }
      } else {
        addMsg(data.error || 'Sorry, I could not process that question.', 'bot');
      }
    } catch (err) {
      removeTyping();
      addMsg('Connection error. Please try again.', 'bot');
    }
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(input.value); });
  document.querySelectorAll('.dm-sug').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
  });
})();

// ===== WHAT-IF SCENARIO =====
async function setupWhatIf() {
  const section = $('#whatif-section');
  if (section) section.classList.add('hidden');
}

let _whatIfTimer = null;
function updateSliderLabel(val) {
  const label = $('#slider-label');
  if (label) label.textContent = `${val > 0 ? '+' : ''}${val}%`;
  // Auto-run What-If with debounce
  clearTimeout(_whatIfTimer);
  _whatIfTimer = setTimeout(() => { runWhatIf(); }, 400);
}

async function runWhatIf() {
  const targetCol = $('#whatif-target')?.value;
  const adjustCol = $('#whatif-adjust')?.value;
  const adjustPct = parseFloat($('#whatif-slider')?.value || 0);

  if (!targetCol || !adjustCol) {
    showToast('Please select both target and adjust columns', 'error');
    return;
  }

  const resultDiv = $('#whatif-result');
  const chartImg = $('#whatif-chart');
  resultDiv.innerHTML = '<span style="color:var(--text-dim)">Running scenario...</span>';

  try {
    let df = DataEngine.clean_data;
    let targetVals = ChartsEngine.numVals(df, targetCol);
    let adjustVals = ChartsEngine.numVals(df, adjustCol);
    let minLen = Math.min(targetVals.length, adjustVals.length);
    targetVals = targetVals.slice(0, minLen);
    adjustVals = adjustVals.slice(0, minLen);

    let pearson = ChartsEngine.pearson(targetVals, adjustVals);

    if (Math.abs(pearson) < 0.05) {
      resultDiv.innerHTML = `<span style="color:var(--warning)"><strong>Low Correlation:</strong> These columns have no meaningful relationship (r=${pearson.toFixed(2)}). Adjusting <em>${adjustCol}</em> is unlikely to predictably impact <em>${targetCol}</em>.</span>`;
      if (document.getElementById('whatif-plotly')) document.getElementById('whatif-plotly').style.display = 'none';
      return;
    }

    let origSum = targetVals.reduce((a, b) => a + b, 0);
    // Simplified elasticity projection: % change in Y = % change in X * r
    let projectedSum = origSum * (1 + ((adjustPct / 100) * pearson));

    const orig = origSum.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const proj = projectedSum.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const diff = projectedSum - origSum;
    const diffPct = origSum ? ((diff / origSum) * 100).toFixed(1) : 0;
    const arrow = diff >= 0 ? '↑' : '↓';
    const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';

    resultDiv.innerHTML = `
      <strong>${targetCol}</strong>: ${orig} → <span style="color:${color};font-weight:700">${proj}</span>
      <span style="color:${color};font-size:0.85rem;margin-left:8px">${arrow} ${diffPct}%</span>
      <span style="color:var(--text-muted);font-size:0.8rem;margin-left:8px">(r=${pearson.toFixed(2)})</span>
      <div id="whatif-ai-commentary" style="margin-top: 12px; font-size: 0.9rem; padding-left: 12px; border-left: 2px solid var(--primary);">
         <span class="skeleton-text" style="width:100%"></span>
      </div>
    `;

    let wiDiv = document.getElementById('whatif-plotly');
    if (!wiDiv) {
      wiDiv = document.createElement('div');
      wiDiv.id = 'whatif-plotly';
      wiDiv.style.cssText = 'width:100%;height:320px;margin-top:16px;';
      if (chartImg && chartImg.parentNode) {
        chartImg.parentNode.insertBefore(wiDiv, chartImg);
        chartImg.classList.add('hidden');
      } else {
        resultDiv.parentNode.appendChild(wiDiv);
      }
    }
    wiDiv.style.display = 'block';

    const trace = {
      x: ['Current', 'Projected'],
      y: [origSum, projectedSum],
      type: 'bar',
      marker: { color: [ChartsEngine.COLORS[0], color === 'var(--success)' ? ChartsEngine.COLORS[2] : ChartsEngine.COLORS[1]] },
      text: [orig, proj],
      textposition: 'auto'
    };
    const layout = ChartsEngine.getLayoutBase();
    layout.title.text = `Impact of ${adjustPct > 0 ? '+' : ''}${adjustPct}% change in ${adjustCol}`;
    
    Plotly.react('whatif-plotly', [trace], layout, { responsive: true, displaylogo: false });

    // AI Commentary
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Scenario: If ${adjustCol} changes by ${adjustPct}%, ${targetCol} is projected to go from ${orig} to ${proj} (a ${diffPct}% change). The correlation is ${pearson.toFixed(2)}.`
        }],
        dataset_summary: DataEngine.eda_results,
        action: 'what_if_insight'
      })
    }).then(r => r.json()).then(data => {
      const commBox = document.getElementById('whatif-ai-commentary');
      if (commBox && data.response) {
        commBox.innerHTML = `<strong>AI Insight:</strong> ${data.response}`;
      }
    }).catch(e => {
       const commBox = document.getElementById('whatif-ai-commentary');
       if (commBox) commBox.innerHTML = `<strong>Insight:</strong> Adjusting ${adjustCol} drives a ${diffPct}% shift in ${targetCol} due to their correlation.`;
    });

  } catch (e) {
    console.error(e);
    resultDiv.textContent = 'Error running scenario: ' + e.message;
  }
}

// ===== EXPORT =====
function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.toggle('active');
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeExport(e) {
      if (!e.target.closest('.export-dropdown')) {
        menu?.classList.remove('active');
        document.removeEventListener('click', closeExport);
      }
    });
  }, 10);
}

async function exportData(format = 'csv') {
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.remove('active');

  try {
    if (!DataEngine.clean_data || DataEngine.clean_data.length === 0) {
      showToast('No dataset loaded', 'error');
      return;
    }
    
    let content = '';
    let filename = '';
    let type = '';

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(DataEngine.clean_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DataMind Export');
      const safeName = (DataEngine.datasetName || 'export').replace(/\s+/g, '_');
      XLSX.writeFile(wb, `datamind_${safeName}.xlsx`);
      showToast('Excel file downloaded!', 'success');
      return;
    } else if (format === 'csv') {
      content = Papa.unparse(DataEngine.clean_data);
      filename = 'datamind_cleaned.csv';
      type = 'text/csv;charset=utf-8;';
    } else if (format === 'json') {
      content = JSON.stringify(DataEngine.eda_results, null, 2);
      filename = 'datamind_report.json';
      type = 'application/json';
    }

    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`${format.toUpperCase()} download started!`, 'success');
  } catch (e) { 
    showToast('Export failed', 'error'); 
  }
}

window.toggleTheme = function(newTheme) {
  if (!newTheme) {
    const current = document.body.getAttribute('data-theme') || 'dark';
    newTheme = current === 'dark' ? 'light' : 'dark';
  }
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('datamind-theme', newTheme);

  // Re-render charts to apply new theme colors
  if (window._allCharts && window._allCharts.length > 0) {
    // We can just call renderCharts to quickly regenerate all plotly instances
    // since DataEngine.clean_data hasn't changed.
    const chartsGrid = document.getElementById('charts-grid');
    if (chartsGrid) {
      // Re-run loadCharts to re-generate plotly_json with new theme colors
      const df = DataEngine.clean_data;
      if (df && df.length > 0) {
        // We can just call applyDateFilters if active, or loadCharts
        if (typeof applyDateFilters === 'function') {
           applyDateFilters();
        } else {
           loadCharts(df);
        }
      }
    }
  }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('datamind-theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  
  initUpload();
  initChat();
  initResize();
  // Modal close
  $('#modal-overlay').addEventListener('click', (e) => { if (e.target === $('#modal-overlay')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
});

// ===== RESIZABLE PANELS =====
function initResize() {
  const layout = $('#app-layout');
  const sidebar = $('#sidebar-panel');
  const chatPanel = $('#chat-panel');
  const leftHandle = $('#resize-left');
  const rightHandle = $('#resize-right');

  if (!layout || !sidebar || !chatPanel) return;

  let isResizing = false;
  let currentHandle = null;

  function onMouseDown(handle) {
    return (e) => {
      e.preventDefault();
      isResizing = true;
      currentHandle = handle;
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
  }

  function onMouseMove(e) {
    if (!isResizing) return;
    const layoutRect = layout.getBoundingClientRect();

    if (currentHandle === leftHandle) {
      let newWidth = e.clientX - layoutRect.left;
      newWidth = Math.max(200, Math.min(450, newWidth));
      layout.style.gridTemplateColumns = `${newWidth}px 4px 1fr 4px ${chatPanel.offsetWidth}px`;
    } else if (currentHandle === rightHandle) {
      let newWidth = layoutRect.right - e.clientX;
      newWidth = Math.max(280, Math.min(550, newWidth));
      layout.style.gridTemplateColumns = `${sidebar.offsetWidth}px 4px 1fr 4px ${newWidth}px`;
    }
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    if (currentHandle) currentHandle.classList.remove('active');
    currentHandle = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  leftHandle.addEventListener('mousedown', onMouseDown(leftHandle));
  rightHandle.addEventListener('mousedown', onMouseDown(rightHandle));
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ===== KPI CARDS =====



function formatKPIValue(value, format) {
  if (format === 'currency') {
    if (value >= 1000000) return `$${(value/1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value/1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  }
  if (format === 'percent') return `${value}%`;
  if (format === 'days') return `${value} days`;
  if (format === 'number') return value.toLocaleString();
  return String(value);
}

function animateKPICounters() {
  document.querySelectorAll('.kpi-value').forEach(el => {
    const target = parseFloat(el.dataset.target);
    const format = el.dataset.format;
    if (isNaN(target)) return;

    let current = 0;
    const increment = target / 40;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = formatKPIValue(current, format);
    }, 30);
  });
}

// ===== DATA QUALITY GAUGE =====
function updateQualityGauge(score, breakdown) {
  const section = $('#quality-section');
  if (!section) return;
  section.style.display = 'block';

  const fill = $('#gauge-fill');
  const text = $('#gauge-text');
  const details = $('#quality-details');

  // Circumference = 2 * PI * r = 2 * 3.1416 * 52 ≈ 326.7
  const circumference = 326.7;
  const offset = circumference - (score / 100) * circumference;

  // Animate after a short delay
  setTimeout(() => {
    fill.style.strokeDashoffset = offset;
    fill.classList.remove('good', 'warn', 'bad');
    if (score >= 80) fill.classList.add('good');
    else if (score >= 60) fill.classList.add('warn');
    else fill.classList.add('bad');
  }, 200);

  text.textContent = `${Math.round(score)}%`;

  if (breakdown) {
    details.innerHTML = `
      <div class="quality-item">
        <span class="qlabel">Completeness</span>
        <span class="qvalue ${breakdown.completeness >= 95 ? 'pass' : breakdown.completeness >= 80 ? 'warn' : 'fail'}">${breakdown.completeness}%</span>
      </div>
      <div class="quality-item">
        <span class="qlabel">Uniqueness</span>
        <span class="qvalue ${breakdown.uniqueness >= 95 ? 'pass' : breakdown.uniqueness >= 80 ? 'warn' : 'fail'}">${breakdown.uniqueness}%</span>
      </div>
      <div class="quality-item">
        <span class="qlabel">Outlier Health</span>
        <span class="qvalue ${breakdown.outlier_health >= 85 ? 'pass' : breakdown.outlier_health >= 70 ? 'warn' : 'fail'}">${breakdown.outlier_health}%</span>
      </div>
    `;
  }
}

// ===== BUSINESS RECOMMENDATIONS =====
async function loadRecommendations() {
  const panel = $('#recommendations-panel');
  panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Business Recommendations</h2></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:80%"></div>`;
  try {
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{role: 'user', content: 'Generate business recommendations.'}], 
        dataset_summary: DataEngine.eda_results,
        action: 'recommendations'
      })
    });
    
    if (!res.ok) throw new Error('API Response not ok');
    const data = await res.json();
    
    if (data.response) {
      let lines = data.response.split('\n').filter(l => l.trim().length > 0);
      let html = `<div class="section-header"><h2>Business Recommendations</h2></div><ul style="padding-left: 20px; color: var(--text); font-size: 0.95rem; line-height: 1.6;">`;
      lines.forEach(line => {
        let cleanLine = line.replace(/^[\-\*\•]\s*/, '').replace(/<\/?strong>/g, '').trim();
        if (cleanLine.length > 5) html += `<li style="margin-bottom: 8px;">${cleanLine}</li>`;
      });
      html += `</ul>`;
      panel.innerHTML = html;
    } else {
      panel.innerHTML = `<div class="section-header"><h2>Business Recommendations</h2></div><p style="color: var(--text-dim); padding: 12px;">Recommendations could not be generated.</p>`;
    }
  } catch (e) { 
    panel.innerHTML = `<div class="section-header"><h2>Business Recommendations</h2></div><p style="color: var(--text-dim); padding: 12px;">Recommendations could not be generated.</p>`;
  }
}

// ===== MOBILE NAVIGATION =====
window.switchMobileTab = function(tabName) {
  // Update active button state
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.mobile-nav-btn[onclick="switchMobileTab('${tabName}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Reset all panel visibility
  const sidebar = document.getElementById('sidebar-panel');
  const chatPanel = document.getElementById('dm-chat-popup');
  const mainContent = document.querySelector('.main-content');

  sidebar.classList.remove('mobile-active');
  chatPanel.classList.remove('mobile-active', 'open');
  mainContent.classList.add('mobile-hidden');

  // Show selected panel
  if (tabName === 'data') {
    sidebar.classList.add('mobile-active');
  } else if (tabName === 'dashboard') {
    mainContent.classList.remove('mobile-hidden');
  } else if (tabName === 'chat') {
    chatPanel.classList.add('mobile-active');
    // Ensure chat is open and full width on mobile
    chatPanel.style.display = 'flex';
  }
};
