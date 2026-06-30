/**
 * DataMind AI - Client-side Charts Engine
 * Generates Plotly.js compatible configurations directly in the browser.
 */

window.ChartsEngine = {
  COLORS: ['#00e5ff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff', '#ff922b','#cc5de8','#20c997','#ff6b81','#a8e6cf'],
  BG: '#0d0f14',
  CARD: '#161a24',
  TEXT: '#e2e8f0',
  GRID: '#2d3748',

  getLayoutBase() {
    return {
      paper_bgcolor: this.BG,
      plot_bgcolor: this.CARD,
      font: { color: this.TEXT, family: 'DM Sans, sans-serif', size: 12 },
      title: { font: { color: this.TEXT, size: 15, family: 'Syne, sans-serif' }, x: 0.02 },
      legend: { bgcolor: this.CARD, bordercolor: this.GRID, borderwidth: 1 },
      xaxis: { gridcolor: this.GRID, zerolinecolor: this.GRID, tickfont: { color: this.TEXT } },
      yaxis: { gridcolor: this.GRID, zerolinecolor: this.GRID, tickfont: { color: this.TEXT } },
      margin: { l: 50, r: 30, t: 60, b: 60 },
      hoverlabel: { bgcolor: this.CARD, bordercolor: this.GRID, font: { color: this.TEXT, size: 12 } }
    };
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // Helper for grouping and summing data
  aggregate(df, catCol, numCol, isDate = false) {
    let grouped = {};
    df.forEach(row => {
      let key = row[catCol];
      if (isDate) key = this.formatDate(key);
      if (key !== null && key !== undefined) {
        grouped[key] = (grouped[key] || 0) + (numCol ? Number(row[numCol]) || 0 : 1);
      }
    });
    return Object.keys(grouped).map(k => ({ key: k, val: grouped[k] })).sort((a,b) => b.val - a.val);
  },

  barChart(df, catCol, numCol, isDate = false, topN = 10) {
    let agg = this.aggregate(df, catCol, numCol, isDate).slice(0, topN);
    if (agg.length < 2) return null;

    let trace = {
      x: agg.map(a => a.key),
      y: agg.map(a => a.val),
      type: 'bar',
      marker: { color: this.COLORS.slice(0, agg.length) },
      hovertemplate: `<b>%{x}</b><br>${numCol}: %{y:,.0f}<extra></extra>`,
      text: agg.map(a => (a.val >= 1e6 ? (a.val/1e6).toFixed(1)+'M' : a.val >= 1e3 ? (a.val/1e3).toFixed(1)+'K' : a.val.toFixed(0))),
      textposition: 'outside',
      textfont: { color: this.TEXT, size: 10 }
    };

    let layout = this.getLayoutBase();
    layout.title.text = `${numCol} by ${catCol}`;
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'bar_chart', description: `Top ${agg.length} categories by ${numCol}.`, plotly_json: { data: [trace], layout: layout } };
  },

  lineChart(df, dateCol, numCol) {
    let agg = this.aggregate(df, dateCol, numCol, true).sort((a,b) => a.key.localeCompare(b.key));
    if (agg.length < 2) return null;

    let trace = {
      x: agg.map(a => a.key),
      y: agg.map(a => a.val),
      type: 'scatter', mode: 'lines+markers',
      line: { color: '#00e5ff', width: 3 },
      marker: { size: 6, color: 'white', line: { color: '#00e5ff', width: 2 } },
      fill: 'tozeroy', fillcolor: 'rgba(0,229,255,0.08)',
      hovertemplate: `<b>%{x}</b><br>${numCol}: %{y:,.0f}<extra></extra>`
    };

    let layout = this.getLayoutBase();
    layout.title.text = `Monthly ${numCol} Trend`;

    return { title: layout.title.text, chart_type: 'line_chart', description: `Monthly trend for ${numCol}.`, plotly_json: { data: [trace], layout: layout } };
  },

  pieChart(df, catCol, numCol, isDate = false) {
    let agg = this.aggregate(df, catCol, numCol, isDate);
    if (agg.length < 2 || agg.length > 8) return null;

    let trace = {
      labels: agg.map(a => a.key),
      values: agg.map(a => a.val),
      type: 'pie',
      marker: { colors: this.COLORS.slice(0, agg.length), line: { color: this.BG, width: 2 } },
      hovertemplate: '<b>%{label}</b><br>Value: %{value:,.0f}<extra></extra>',
      textfont: { color: 'white', size: 11 }
    };

    let layout = this.getLayoutBase();
    layout.title.text = `${catCol} Distribution`;

    return { title: layout.title.text, chart_type: 'pie_chart', description: `Distribution of ${catCol}.`, plotly_json: { data: [trace], layout: layout } };
  },

  // Custom K-Means in JS for RFM
  kMeans(data, k, maxIters = 100) {
    let centroids = data.slice(0, k);
    let assignments = new Array(data.length);
    for (let iter = 0; iter < maxIters; iter++) {
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        let minD = Infinity; let cluster = 0;
        for (let j = 0; j < k; j++) {
          let d = Math.pow(data[i][0] - centroids[j][0], 2) + Math.pow(data[i][1] - centroids[j][1], 2) + Math.pow(data[i][2] - centroids[j][2], 2);
          if (d < minD) { minD = d; cluster = j; }
        }
        if (assignments[i] !== cluster) { assignments[i] = cluster; changed = true; }
      }
      if (!changed) break;
      let newC = Array(k).fill(0).map(()=>[0,0,0]);
      let counts = Array(k).fill(0);
      for (let i = 0; i < data.length; i++) {
        newC[assignments[i]][0] += data[i][0];
        newC[assignments[i]][1] += data[i][1];
        newC[assignments[i]][2] += data[i][2];
        counts[assignments[i]]++;
      }
      for (let j = 0; j < k; j++) { if (counts[j] > 0) { centroids[j] = [newC[j][0]/counts[j], newC[j][1]/counts[j], newC[j][2]/counts[j]]; } }
    }
    return assignments;
  },

  rfmChart(df, custCol, dateCol, valueCol) {
    let customers = {};
    let now = new Date();
    df.forEach(row => {
      let c = row[custCol];
      let d = new Date(row[dateCol]);
      let v = Number(row[valueCol]) || 0;
      if (c && !isNaN(d) && v) {
        if (!customers[c]) customers[c] = { recency: d, freq: 0, monetary: 0 };
        if (d > customers[c].recency) customers[c].recency = d;
        customers[c].freq += 1;
        customers[c].monetary += v;
      }
    });

    let keys = Object.keys(customers);
    if (keys.length < 20) return null;
    
    let rfmData = keys.map(k => {
      let c = customers[k];
      return [(now - c.recency) / (1000*60*60*24), c.freq, c.monetary];
    });

    // Normalize
    let maxR = Math.max(...rfmData.map(d=>d[0])), maxF = Math.max(...rfmData.map(d=>d[1])), maxM = Math.max(...rfmData.map(d=>d[2]));
    let normalized = rfmData.map(d => [d[0]/maxR, d[1]/maxF, d[2]/maxM]);

    let clusters = this.kMeans(normalized, Math.min(4, keys.length));
    let segNames = {0: 'Champions', 1: 'Loyal', 2: 'At Risk', 3: 'Lost'};
    
    let trace = {
      x: rfmData.map(d => d[0]),
      y: rfmData.map(d => d[2]),
      mode: 'markers',
      marker: { size: rfmData.map(d => Math.max(5, (d[1]/maxF)*20)), color: clusters.map(c => this.COLORS[c]), opacity: 0.7 },
      text: keys.map((k,i) => `<b>${k}</b><br>Segment: ${segNames[clusters[i]]}<br>Recency: ${rfmData[i][0].toFixed(0)}d<br>Freq: ${rfmData[i][1]}<br>Value: ${rfmData[i][2].toFixed(0)}`),
      hovertemplate: "%{text}<extra></extra>"
    };

    let layout = this.getLayoutBase();
    layout.title.text = "RFM Customer Segmentation";
    layout.xaxis.title = "Recency (Days)";
    layout.yaxis.title = "Monetary Value";

    return { title: layout.title.text, chart_type: 'rfm_chart', description: "K-Means clustered RFM analysis.", plotly_json: { data: [trace], layout: layout } };
  }
};
