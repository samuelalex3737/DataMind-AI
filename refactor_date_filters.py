import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    data = f.read()

# 1. Update loadCharts signature
lc_old = r"async function loadCharts\(\) \{"
lc_new = """async function loadCharts(customData = null) {
  let df = customData || DataEngine.clean_data;"""
data = re.sub(lc_old, lc_new, data)
data = data.replace("let df = DataEngine.clean_data;", "") # Remove the duplicate line from earlier

# 2. Update resetDateFilters
reset_old = r"""window\.resetDateFilters = async \(\) => \{[\s\S]*?\} catch\(e\) \{[\s\S]*?\}
\};"""
reset_new = """window.resetDateFilters = async () => {
  if ($('#date-from')) $('#date-from').value = '';
  if ($('#date-to')) $('#date-to').value = '';
  loadCharts();
  loadKPIs();
};"""
data = re.sub(reset_old, reset_new, data)

# 3. Update applyDateFilters
apply_old = r"""window\.applyDateFilters = async \(\) => \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}
\};"""
apply_new = """window.applyDateFilters = async () => {
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
};"""
data = re.sub(apply_old, apply_new, data)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(data)
print("Refactored date filters!")
