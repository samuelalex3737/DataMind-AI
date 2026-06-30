import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Replace exportData
exp_old = r"""async function exportData\(format = 'csv'\) \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}
\}"""
exp_new = """async function exportData(format = 'csv') {
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
}"""
data = re.sub(exp_old, exp_new, data)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(data)
print("Refactored exportData!")
