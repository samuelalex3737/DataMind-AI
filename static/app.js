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
async function startAnalysis(datasetInfo) {
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
        let minD = new Date(Math.min(...dates)).toISOString().split('T')[0];
        let maxD = new Date(Math.max(...dates)).toISOString().split('T')[0];
        const df = $('#date-from');
        const dt = $('#date-to');
        if (df) { df.min = minD; df.max = maxD; }
        if (dt) { dt.min = minD; dt.max = maxD; }
      }
    } catch(e) {}
    const filters = $('#date-filters-container');
    if (filters) filters.style.display = 'flex';
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
  
  let filtered = DataEngine.clean_data.filter(row => {
    let d = new Date(row[dCol]);
    if (isNaN(d)) return false;
    if (dFrom && d < new Date(dFrom)) return false;
    if (dTo && d > new Date(dTo)) return false;
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

    // ── Detect ID-like columns (>80% unique values) ──
    let idCols = [];
    let safeCatCols = [];
    catCols.forEach(c => {
      let seen = {};
      let total = 0;
      for (let i = 0; i < Math.min(df.length, 500); i++) {
        let v = df[i][c];
        if (v !== null && v !== undefined && v !== '') {
          seen[v] = true;
          total++;
        }
      }
      let uniq = Object.keys(seen).length;
      if (total > 0 && uniq / total > 0.8) {
        idCols.push(c);
      } else {
        safeCatCols.push(c);
      }
    });

    // Use idCols for customer/order ID analysis, safeCatCols for bar/pie
    let custCol = idCols.length > 0 ? idCols[0] : null;
    let productCol = safeCatCols.length > 0 ? safeCatCols[0] : null;

    // Helper to push if not null with try/catch to prevent pipeline freezes
    function safeAdd(chartFunc) { 
      try {
        let result = chartFunc();
        if (result) charts.push(result); 
      } catch (e) {
        console.warn('Chart generation failed, skipping:', e);
      }
    }

    // ── 1. For each (cat_col, num_col) pair: bar_chart, pie_chart ──
    let catNumDone = 0;
    for (let ci = 0; ci < safeCatCols.length && catNumDone < 3; ci++) {
      for (let ni = 0; ni < numCols.length && catNumDone < 3; ni++) {
        safeAdd(() => ChartsEngine.barChart(df, safeCatCols[ci], numCols[ni]));
        safeAdd(() => ChartsEngine.pieChart(df, safeCatCols[ci], numCols[ni]));
        catNumDone++;
      }
    }

    // ── 2. First (cat_col, num_col): doughnut, pareto, treemap ──
    if (safeCatCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.doughnutChart(df, safeCatCols[0], numCols[0]));
      safeAdd(() => ChartsEngine.paretoChart(df, safeCatCols[0], numCols[0]));
      safeAdd(() => ChartsEngine.treemapChart(df, safeCatCols[0], numCols[0]));
    }

    // ── 3. For each (date_col, num_col) pair: line_chart ──
    let linesDone = 0;
    for (let di = 0; di < dateCols.length && linesDone < 2; di++) {
      for (let ni = 0; ni < numCols.length && linesDone < 3; ni++) {
        safeAdd(() => ChartsEngine.lineChart(df, dateCols[di], numCols[ni]));
        linesDone++;
      }
    }

    // ── 4. First (cat1, cat2, num_col): grouped_bar, stacked_bar ──
    if (safeCatCols.length >= 2 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.groupedBar(df, safeCatCols[0], safeCatCols[1], numCols[0]));
      safeAdd(() => ChartsEngine.stackedBar(df, safeCatCols[0], safeCatCols[1], numCols[0]));
    }

    // ── 5. First (date_col, num1, num2): double_axis, waterfall ──
    if (dateCols.length > 0 && numCols.length >= 2) {
      safeAdd(() => ChartsEngine.doubleAxisChart(df, dateCols[0], numCols[0], numCols[1]));
    }
    if (dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.waterfallChart(df, dateCols[0], numCols[0]));
    }

    // ── 6. First (cat_col, numCols list): radar ──
    if (safeCatCols.length > 0 && numCols.length >= 3) {
      safeAdd(() => ChartsEngine.radarChart(df, safeCatCols[0], numCols.slice(0, 6)));
    }

    // ── 7. First num_col: histogram ──
    if (numCols.length > 0) {
      safeAdd(() => ChartsEngine.histogram(df, numCols[0]));
    }

    // ── 8. All num_cols: box_plot, heatmap_corr ──
    if (numCols.length > 0) {
      safeAdd(() => ChartsEngine.boxPlot(df, numCols));
    }
    if (numCols.length >= 2) {
      safeAdd(() => ChartsEngine.heatmapCorr(df, numCols));
    }

    // ── 9. First (num_col, cat_col): violin ──
    if (numCols.length > 0 && safeCatCols.length > 0) {
      safeAdd(() => ChartsEngine.violinPlot(df, numCols[0], safeCatCols[0]));
    }

    // ── 10. First (date_col, num_col): seasonal_heatmap ──
    if (dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.seasonalHeatmap(df, dateCols[0], numCols[0]));
    }

    // ── 11. Sunburst: first (parent_col, child_col, num_col) where 2 cat cols ──
    if (safeCatCols.length >= 2 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.sunburstChart(df, safeCatCols[0], safeCatCols[1], numCols[0]));
    }

    // ── 12. RFM: first (cust_col, date_col, value_col) ──
    if (custCol && dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.rfmChart(df, custCol, dateCols[0], numCols[0]));
    } else if (safeCatCols.length > 0 && dateCols.length > 0 && numCols.length > 0) {
      safeAdd(() => ChartsEngine.rfmChart(df, safeCatCols[0], dateCols[0], numCols[0]));
    }

    // ── 13. Market Basket: first (cust_col, product_col) ──
    if (custCol && productCol) {
      safeAdd(() => ChartsEngine.marketBasketChart(df, custCol, productCol));
    }

    // ── 14. Cohort Retention: first (cust_col, date_col) ──
    if (custCol && dateCols.length > 0) {
      safeAdd(() => ChartsEngine.cohortRetention(df, custCol, dateCols[0]));
    }

    // ── 15. BCG Matrix: first (product_col, value_col, date_col) ──
    if (productCol && numCols.length > 0 && dateCols.length > 0) {
      safeAdd(() => ChartsEngine.bcgMatrix(df, productCol, numCols[0], dateCols[0]));
    }

    // ── 16. Scatter: first 2 num cols ──
    if (numCols.length >= 2) {
      safeAdd(() => ChartsEngine.scatterChart(df, numCols[0], numCols[1]));
    }

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

  // Remove any existing search bar (prevents duplicates on re-render)
  const existingSearch = document.querySelector('.chart-search-bar');
  if (existingSearch) existingSearch.remove();

  // Add search/filter bar above charts
  const searchBar = document.createElement('div');
  searchBar.className = 'chart-search-bar';
  searchBar.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="chart-search" placeholder="Search charts..." oninput="filterCharts(this.value)">
    <span class="chart-count" id="chart-count">${charts.length} charts</span>`;
  grid.parentNode.insertBefore(searchBar, grid);

  window._allCharts = charts; // Store for filtering

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
      </div>`;
    grid.appendChild(card);

    if (chart.plotly_json) {
      const config = {
        responsive: true, displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: {
          format: 'png',
          filename: chart.title || 'datamind_chart',
          height: null,
          width: null,
          scale: 2
        },
        modeBarButtonsToAdd: [{
          name: 'Fullscreen',
          icon: { width: 24, height: 24, path: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3', transform: 'matrix(1 0 0 1 0 0)' },
          click: function(gd) { expandPlotlyChart(gd.id); }
        }]
      };
      Plotly.newPlot(chartDivId, chart.plotly_json.data, chart.plotly_json.layout, config);
    }
  });
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
  if (panel) panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Forecast</h2></div><p style="color:var(--text-dim);padding:20px;">Time-series forecasting is only available in the advanced Python backend.</p>`;
}

// ===== INSIGHTS =====
async function loadInsights(isRetry = false) {
  const panel = $('#insights-panel');
  panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> Key Insights</h2></div><div class="skeleton skeleton-text"></div>`;
  try {
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{role: 'user', content: 'Generate 3 bullet points of key insights for this dataset.'}], dataset_summary: DataEngine.eda_results })
    });
    const data = await res.json();
    if (data.response) {
      let html = `<div class="section-header"><h2>Key Insights</h2></div>`;
      html += `<div class="insight-item"><span>${data.response}</span></div>`;
      panel.innerHTML = html;
    } else {
      panel.innerHTML = `<div class="section-header"><h2>Key Insights</h2></div><p>Insights could not be generated.</p>`;
    }
  } catch (e) { 
    panel.innerHTML = `<div class="section-header"><h2>Key Insights</h2></div><p>Insights could not be generated.</p>`;
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
  const adjustPct = $('#whatif-slider')?.value || 0;

  if (!targetCol || !adjustCol) {
    showToast('Please select both target and adjust columns', 'error');
    return;
  }

  const resultDiv = $('#whatif-result');
  const chartImg = $('#whatif-chart');
  resultDiv.textContent = 'Running scenario...';

  try {
    const data = { success: false, error: 'What-If analysis requires the advanced Python backend.' };

    if (data.success) {
      const orig = data.original?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '—';
      const proj = data.projected?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '—';
      const diff = data.projected - data.original;
      const diffPct = data.original ? ((diff / data.original) * 100).toFixed(1) : 0;
      const arrow = diff >= 0 ? '↑' : '↓';
      const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';

      resultDiv.innerHTML = `
        <strong>${targetCol}</strong>: ${orig} → <span style="color:${color};font-weight:700">${proj}</span>
        <span style="color:${color};font-size:0.85rem;margin-left:8px">${arrow} ${diffPct}%</span>
        <span style="color:var(--text-muted);font-size:0.8rem;margin-left:8px">(when ${adjustCol} changes by ${adjustPct > 0 ? '+' : ''}${adjustPct}%)</span>
      `;

      if (data.chart_json) {
        let wiDiv = document.getElementById('whatif-plotly');
        if (!wiDiv) {
          wiDiv = document.createElement('div');
          wiDiv.id = 'whatif-plotly';
          wiDiv.style.cssText = 'width:100%;height:380px;margin-top:16px;';
          chartImg.parentNode.insertBefore(wiDiv, chartImg);
        }
        Plotly.react('whatif-plotly', data.chart_json.data, data.chart_json.layout, { responsive: true, displaylogo: false });
        chartImg.classList.add('hidden');
      }
    } else {
      resultDiv.textContent = data.error || 'Scenario failed';
    }
  } catch (e) {
    resultDiv.textContent = 'Error running scenario';
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

    if (format === 'csv' || format === 'excel') {
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
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
  panel.innerHTML = `<div class="section-header"><h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Business Recommendations</h2></div><div class="skeleton skeleton-text"></div>`;
  try {
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{role: 'user', content: 'Generate 2 business recommendations based on this data.'}], dataset_summary: DataEngine.eda_results })
    });
    const data = await res.json();
    if (data.response) {
      let html = `<div class="section-header"><h2>Business Recommendations</h2></div>`;
      html += `<div class="insight-item"><span>${data.response}</span></div>`;
      panel.innerHTML = html;
    } else {
      panel.innerHTML = `<div class="section-header"><h2>Business Recommendations</h2></div><p>Recommendations could not be generated.</p>`;
    }
  } catch (e) { 
    panel.innerHTML = `<div class="section-header"><h2>Business Recommendations</h2></div><p>Recommendations could not be generated.</p>`;
  }
}

