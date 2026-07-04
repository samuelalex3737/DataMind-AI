/**
 * DataMind AI — Client-side Charts Engine (Full 22-chart rebuild)
 * Generates Plotly.js compatible configurations directly in the browser.
 *
 * Charts Core  (11): line, bar, grouped_bar, stacked_bar, pie, doughnut,
 *                     histogram, box_plot, violin, heatmap_corr, seasonal_heatmap
 * Charts Adv.  (11): waterfall, double_axis, pareto, radar, treemap, sunburst,
 *                     rfm (K-Means), market_basket (Apriori), cohort_retention,
 *                     bcg_matrix, scatter
 */

window.ChartsEngine = {

  // ─── palette ────────────────────────────────────────────
  COLORS: ['#00e5ff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
           '#ff922b','#cc5de8','#20c997','#ff6b81','#a8e6cf'],
  BG:   '#0d0f14',
  CARD: '#161a24',
  TEXT: '#e2e8f0',
  GRID: '#2d3748',

  // ─── shared layout ─────────────────────────────────────
  getLayoutBase() {
    return {
      paper_bgcolor: this.BG,
      plot_bgcolor:  this.CARD,
      font:   { color: this.TEXT, family: 'DM Sans, sans-serif', size: 12 },
      title:  { font: { color: this.TEXT, size: 15, family: 'Syne, sans-serif' }, x: 0.02 },
      legend: { bgcolor: this.CARD, bordercolor: this.GRID, borderwidth: 1 },
      xaxis:  { gridcolor: this.GRID, zerolinecolor: this.GRID, tickfont: { color: this.TEXT } },
      yaxis:  { gridcolor: this.GRID, zerolinecolor: this.GRID, tickfont: { color: this.TEXT } },
      margin: { l: 50, r: 30, t: 60, b: 60 },
      hoverlabel: { bgcolor: this.CARD, bordercolor: this.GRID, font: { color: this.TEXT, size: 12 } }
    };
  },

  // ─── helpers ────────────────────────────────────────────
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },

  fmtNum(v) {
    if (v >= 1e6)  return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
    return Number(v).toFixed(0);
  },

  /** Aggregate df rows by catCol → sum(numCol). Returns sorted desc by val. */
  aggregate(df, catCol, numCol, isDate) {
    var grouped = {};
    for (var i = 0; i < df.length; i++) {
      var row = df[i];
      var key = isDate ? this.formatDate(row[catCol]) : row[catCol];
      if (key === null || key === undefined || key === '') continue;
      grouped[key] = (grouped[key] || 0) + (numCol ? (Number(row[numCol]) || 0) : 1);
    }
    var result = [];
    var keys = Object.keys(grouped);
    for (var j = 0; j < keys.length; j++) {
      result.push({ key: keys[j], val: grouped[keys[j]] });
    }
    result.sort(function(a, b) { return b.val - a.val; });
    return result;
  },

  /** Aggregate returning average instead of sum */
  aggregateAvg(df, catCol, numCol, isDate) {
    var sums = {}, counts = {};
    for (var i = 0; i < df.length; i++) {
      var row = df[i];
      var key = isDate ? this.formatDate(row[catCol]) : row[catCol];
      if (key === null || key === undefined || key === '') continue;
      var v = Number(row[numCol]);
      if (isNaN(v)) continue;
      sums[key] = (sums[key] || 0) + v;
      counts[key] = (counts[key] || 0) + 1;
    }
    var result = [];
    var keys = Object.keys(sums);
    for (var j = 0; j < keys.length; j++) {
      result.push({ key: keys[j], val: sums[keys[j]] / counts[keys[j]] });
    }
    result.sort(function(a, b) { return b.val - a.val; });
    return result;
  },

  /** Return unique values for a column */
  unique(df, col) {
    var seen = {}, out = [];
    for (var i = 0; i < df.length; i++) {
      var v = df[i][col];
      if (v !== null && v !== undefined && v !== '' && !seen[v]) { seen[v] = true; out.push(v); }
    }
    return out;
  },

  /** Pearson correlation between two arrays */
  pearson(a, b) {
    var n = a.length;
    if (n === 0) return 0;
    var sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    for (var i = 0; i < n; i++) {
      sumA  += a[i]; sumB  += b[i]; sumAB += a[i] * b[i];
      sumA2 += a[i] * a[i]; sumB2 += b[i] * b[i];
    }
    var denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    if (denom === 0) return 0;
    return (n * sumAB - sumA * sumB) / denom;
  },

  /** Numeric column values (NaN-filtered) */
  numVals(df, col) {
    var out = [];
    for (var i = 0; i < df.length; i++) {
      var v = Number(df[i][col]);
      if (!isNaN(v)) out.push(v);
    }
    return out;
  },

  // ──────────────────────────────────────────────────────────
  //  1. LINE CHART — monthly trend line with area fill
  // ──────────────────────────────────────────────────────────
  lineChart(df, dateCol, numCol) {
    var agg = this.aggregate(df, dateCol, numCol, true);
    agg.sort(function(a, b) { return a.key.localeCompare(b.key); });
    if (agg.length < 2) return null;

    var trace = {
      x: agg.map(function(a){ return a.key; }),
      y: agg.map(function(a){ return a.val; }),
      type: 'scatter', mode: 'lines+markers',
      line:   { color: '#00e5ff', width: 3 },
      marker: { size: 6, color: 'white', line: { color: '#00e5ff', width: 2 } },
      fill: 'tozeroy', fillcolor: 'rgba(0,229,255,0.08)',
      hovertemplate: '<b>%{x}</b><br>' + numCol + ': %{y:,.0f}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Monthly ' + numCol + ' Trend';

    return { title: layout.title.text, chart_type: 'line_chart',
             description: 'Monthly trend for ' + numCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  2. BAR CHART — Top N categories
  // ──────────────────────────────────────────────────────────
  barChart(df, catCol, numCol, topN) {
    if (topN === undefined) topN = 10;
    var agg = this.aggregate(df, catCol, numCol, false).slice(0, topN);
    if (agg.length < 2) return null;
    var self = this;

    var trace = {
      x: agg.map(function(a){ return a.key; }),
      y: agg.map(function(a){ return a.val; }),
      type: 'bar',
      marker: { color: this.COLORS.slice(0, agg.length) },
      hovertemplate: '<b>%{x}</b><br>' + numCol + ': %{y:,.0f}<extra></extra>',
      text: agg.map(function(a){ return self.fmtNum(a.val); }),
      textposition: 'outside',
      textfont: { color: this.TEXT, size: 10 }
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' by ' + catCol;
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'bar_chart',
             description: 'Top ' + agg.length + ' categories by ' + numCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  3. GROUPED BAR — two categorical dimensions
  // ──────────────────────────────────────────────────────────
  groupedBar(df, cat1, cat2, numCol) {
    var vals1 = this.unique(df, cat1).slice(0, 6);
    var vals2 = this.unique(df, cat2).slice(0, 6);
    if (vals1.length < 2 || vals2.length < 2) return null;

    var self = this;
    var traces = [];
    for (var j = 0; j < vals2.length; j++) {
      var yVals = [];
      for (var i = 0; i < vals1.length; i++) {
        var sum = 0;
        for (var r = 0; r < df.length; r++) {
          if (String(df[r][cat1]) === String(vals1[i]) && String(df[r][cat2]) === String(vals2[j])) {
            sum += Number(df[r][numCol]) || 0;
          }
        }
        yVals.push(sum);
      }
      traces.push({
        x: vals1, y: yVals, name: String(vals2[j]), type: 'bar',
        marker: { color: self.COLORS[j % self.COLORS.length] }
      });
    }

    var layout = this.getLayoutBase();
    layout.barmode = 'group';
    layout.title.text = numCol + ' by ' + cat1 + ' & ' + cat2;
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'grouped_bar',
             description: 'Grouped bar of ' + numCol + ' across ' + cat1 + ' and ' + cat2 + '.',
             plotly_json: { data: traces, layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  4. STACKED BAR — two categorical dimensions
  // ──────────────────────────────────────────────────────────
  stackedBar(df, cat1, cat2, numCol) {
    var vals1 = this.unique(df, cat1).slice(0, 6);
    var vals2 = this.unique(df, cat2).slice(0, 6);
    if (vals1.length < 2 || vals2.length < 2) return null;

    var self = this;
    var traces = [];
    for (var j = 0; j < vals2.length; j++) {
      var yVals = [];
      for (var i = 0; i < vals1.length; i++) {
        var sum = 0;
        for (var r = 0; r < df.length; r++) {
          if (String(df[r][cat1]) === String(vals1[i]) && String(df[r][cat2]) === String(vals2[j])) {
            sum += Number(df[r][numCol]) || 0;
          }
        }
        yVals.push(sum);
      }
      traces.push({
        x: vals1, y: yVals, name: String(vals2[j]), type: 'bar',
        marker: { color: self.COLORS[j % self.COLORS.length] }
      });
    }

    var layout = this.getLayoutBase();
    layout.barmode = 'stack';
    layout.title.text = numCol + ' Stacked by ' + cat1 + ' & ' + cat2;
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'stacked_bar',
             description: 'Stacked bar of ' + numCol + ' across ' + cat1 + ' and ' + cat2 + '.',
             plotly_json: { data: traces, layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  5. PIE CHART — category distribution (hole=0)
  // ──────────────────────────────────────────────────────────
  pieChart(df, catCol, numCol) {
    var agg = this.aggregate(df, catCol, numCol, false);
    if (agg.length < 2 || agg.length > 12) return null;

    var trace = {
      labels: agg.map(function(a){ return a.key; }),
      values: agg.map(function(a){ return a.val; }),
      type: 'pie', hole: 0,
      marker: { colors: this.COLORS.slice(0, agg.length), line: { color: this.BG, width: 2 } },
      hovertemplate: '<b>%{label}</b><br>Value: %{value:,.0f}<extra></extra>',
      textfont: { color: 'white', size: 11 }
    };

    var layout = this.getLayoutBase();
    layout.title.text = catCol + ' Distribution';

    return { title: layout.title.text, chart_type: 'pie_chart',
             description: 'Distribution of ' + catCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  6. DOUGHNUT CHART — hole=0.55, center annotation total
  // ──────────────────────────────────────────────────────────
  doughnutChart(df, catCol, numCol) {
    var agg = this.aggregate(df, catCol, numCol, false);
    if (agg.length < 2 || agg.length > 12) return null;

    var total = 0;
    for (var i = 0; i < agg.length; i++) total += agg[i].val;

    var trace = {
      labels: agg.map(function(a){ return a.key; }),
      values: agg.map(function(a){ return a.val; }),
      type: 'pie', hole: 0.55,
      marker: { colors: this.COLORS.slice(0, agg.length), line: { color: this.BG, width: 2 } },
      hovertemplate: '<b>%{label}</b><br>Value: %{value:,.0f}<extra></extra>',
      textfont: { color: 'white', size: 11 }
    };

    var layout = this.getLayoutBase();
    layout.title.text = catCol + ' Doughnut';
    layout.annotations = [{
      text: this.fmtNum(total),
      font: { size: 20, color: this.TEXT, family: 'Syne, sans-serif' },
      showarrow: false, x: 0.5, y: 0.5
    }];

    return { title: layout.title.text, chart_type: 'doughnut_chart',
             description: 'Doughnut chart of ' + catCol + '. Total: ' + this.fmtNum(total) + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  7. HISTOGRAM — distribution with mean/median lines
  // ──────────────────────────────────────────────────────────
  histogram(df, numCol) {
    var vals = this.numVals(df, numCol);
    if (vals.length < 10) return null;

    var sum = 0;
    for (var i = 0; i < vals.length; i++) sum += vals[i];
    var mean = sum / vals.length;
    var sorted = vals.slice().sort(function(a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];

    var trace = {
      x: vals, type: 'histogram',
      marker: { color: 'rgba(0,229,255,0.6)', line: { color: '#00e5ff', width: 1 } },
      hovertemplate: 'Range: %{x}<br>Count: %{y}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' Distribution';
    layout.xaxis.title = numCol;
    layout.yaxis.title = 'Count';
    layout.shapes = [
      { type: 'line', x0: mean, x1: mean, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ff6b6b', width: 2, dash: 'dash' } },
      { type: 'line', x0: median, x1: median, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ffd93d', width: 2, dash: 'dot' } }
    ];
    layout.annotations = [
      { x: mean, y: 1, yref: 'paper', text: 'Mean: ' + this.fmtNum(mean),
        showarrow: true, arrowhead: 2, ax: 40, ay: -30, font: { color: '#ff6b6b', size: 11 } },
      { x: median, y: 0.9, yref: 'paper', text: 'Median: ' + this.fmtNum(median),
        showarrow: true, arrowhead: 2, ax: -40, ay: -30, font: { color: '#ffd93d', size: 11 } }
    ];

    return { title: layout.title.text, chart_type: 'histogram',
             description: 'Distribution of ' + numCol + '. Mean=' + mean.toFixed(1) + ', Median=' + median.toFixed(1) + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  8. BOX PLOT — multiple numeric columns, boxmean=True
  // ──────────────────────────────────────────────────────────
  boxPlot(df, numCols) {
    if (!numCols || numCols.length < 1) return null;
    var self = this;
    var traces = [];
    for (var i = 0; i < Math.min(numCols.length, 8); i++) {
      var vals = self.numVals(df, numCols[i]);
      if (vals.length < 5) continue;
      traces.push({
        y: vals, type: 'box', name: numCols[i], boxmean: true,
        marker: { color: self.COLORS[i % self.COLORS.length] }
      });
    }
    if (traces.length < 1) return null;

    var layout = this.getLayoutBase();
    layout.title.text = 'Box Plot — Numeric Distributions';

    return { title: layout.title.text, chart_type: 'box_plot',
             description: 'Box plot showing distribution of ' + traces.length + ' numeric columns.',
             plotly_json: { data: traces, layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  9. VIOLIN PLOT — per category with box visible
  // ──────────────────────────────────────────────────────────
  violinPlot(df, numCol, catCol) {
    var cats = this.unique(df, catCol).slice(0, 6);
    if (cats.length < 2) return null;
    var self = this;

    var traces = [];
    for (var i = 0; i < cats.length; i++) {
      var vals = [];
      for (var r = 0; r < df.length; r++) {
        if (String(df[r][catCol]) === String(cats[i])) {
          var v = Number(df[r][numCol]);
          if (!isNaN(v)) vals.push(v);
        }
      }
      if (vals.length < 3) continue;
      traces.push({
        y: vals, type: 'violin', name: String(cats[i]),
        box: { visible: true }, meanline: { visible: true },
        marker: { color: self.COLORS[i % self.COLORS.length] }
      });
    }
    if (traces.length < 2) return null;

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' Distribution by ' + catCol;

    return { title: layout.title.text, chart_type: 'violin_plot',
             description: 'Violin plot of ' + numCol + ' across ' + catCol + ' categories.',
             plotly_json: { data: traces, layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  10. HEATMAP CORRELATION — RdBu, zmid=0, annotations
  // ──────────────────────────────────────────────────────────
  heatmapCorr(df, numCols) {
    if (!numCols || numCols.length < 2) return null;
    var cols = numCols.slice(0, 10);
    var self = this;

    // build arrays
    var colArrays = [];
    for (var c = 0; c < cols.length; c++) {
      colArrays.push(self.numVals(df, cols[c]));
    }

    var z = [], annotations = [];
    for (var i = 0; i < cols.length; i++) {
      var row = [];
      for (var j = 0; j < cols.length; j++) {
        // align lengths
        var minLen = Math.min(colArrays[i].length, colArrays[j].length);
        var corr = self.pearson(colArrays[i].slice(0, minLen), colArrays[j].slice(0, minLen));
        row.push(Math.round(corr * 100) / 100);
        annotations.push({
          x: cols[j], y: cols[i], text: corr.toFixed(2),
          font: { color: Math.abs(corr) > 0.5 ? 'white' : self.TEXT, size: 10 },
          showarrow: false
        });
      }
      z.push(row);
    }

    var trace = {
      z: z, x: cols, y: cols, type: 'heatmap',
      colorscale: 'RdBu', zmid: 0, zmin: -1, zmax: 1,
      hovertemplate: '%{y} vs %{x}: %{z:.2f}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Correlation Matrix';
    layout.annotations = annotations;
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'heatmap_corr',
             description: 'Pearson correlation heatmap of numeric columns.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  11. SEASONAL HEATMAP — Month vs Year, YlOrRd
  // ──────────────────────────────────────────────────────────
  seasonalHeatmap(df, dateCol, numCol) {
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var buckets = {}; // { year: { month: sum } }
    for (var i = 0; i < df.length; i++) {
      var d = new Date(df[i][dateCol]);
      if (isNaN(d)) continue;
      var y = d.getFullYear(), m = d.getMonth();
      if (!buckets[y]) buckets[y] = {};
      buckets[y][m] = (buckets[y][m] || 0) + (Number(df[i][numCol]) || 0);
    }

    var years = Object.keys(buckets).sort();
    if (years.length < 1) return null;

    var z = [], annotations = [];
    for (var yi = 0; yi < years.length; yi++) {
      var row = [];
      for (var mi = 0; mi < 12; mi++) {
        var val = (buckets[years[yi]] && buckets[years[yi]][mi]) ? buckets[years[yi]][mi] : 0;
        row.push(val);
        if (val > 0) {
          annotations.push({
            x: monthNames[mi], y: years[yi], text: this.fmtNum(val),
            font: { color: 'white', size: 9 }, showarrow: false
          });
        }
      }
      z.push(row);
    }

    var trace = {
      z: z, x: monthNames, y: years, type: 'heatmap',
      colorscale: 'YlOrRd',
      hovertemplate: '%{y} %{x}: %{z:,.0f}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Seasonal ' + numCol + ' Heatmap';
    layout.annotations = annotations;

    return { title: layout.title.text, chart_type: 'seasonal_heatmap',
             description: 'Month-by-year heatmap showing seasonal patterns in ' + numCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  12. WATERFALL CHART — monthly changes
  // ──────────────────────────────────────────────────────────
  waterfallChart(df, dateCol, numCol) {
    var agg = this.aggregate(df, dateCol, numCol, true);
    agg.sort(function(a, b) { return a.key.localeCompare(b.key); });
    if (agg.length < 3) return null;

    var xLabels = ['Start'], measure = ['absolute'], yValues = [agg[0].val];
    var textVals = [this.fmtNum(agg[0].val)];
    var self = this;

    for (var i = 1; i < agg.length; i++) {
      var diff = agg[i].val - agg[i - 1].val;
      xLabels.push(agg[i].key);
      measure.push('relative');
      yValues.push(diff);
      textVals.push((diff >= 0 ? '+' : '') + self.fmtNum(diff));
    }

    // final total
    xLabels.push('Total');
    measure.push('total');
    yValues.push(agg[agg.length - 1].val);
    textVals.push(this.fmtNum(agg[agg.length - 1].val));

    var trace = {
      type: 'waterfall', orientation: 'v',
      x: xLabels, y: yValues, measure: measure,
      text: textVals, textposition: 'outside',
      textfont: { color: this.TEXT, size: 10 },
      connector: { line: { color: this.GRID } },
      increasing: { marker: { color: '#6bcb77' } },
      decreasing: { marker: { color: '#ff6b6b' } },
      totals:     { marker: { color: '#4d96ff' } }
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' Waterfall (Monthly Changes)';
    layout.xaxis.tickangle = -35;

    return { title: layout.title.text, chart_type: 'waterfall_chart',
             description: 'Waterfall of monthly ' + numCol + ' changes.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  13. DOUBLE AXIS CHART — dual Y-axis monthly trend
  // ──────────────────────────────────────────────────────────
  doubleAxisChart(df, dateCol, num1, num2) {
    var agg1 = this.aggregate(df, dateCol, num1, true);
    agg1.sort(function(a, b) { return a.key.localeCompare(b.key); });
    var agg2 = this.aggregate(df, dateCol, num2, true);
    agg2.sort(function(a, b) { return a.key.localeCompare(b.key); });
    if (agg1.length < 2 || agg2.length < 2) return null;

    var trace1 = {
      x: agg1.map(function(a){ return a.key; }),
      y: agg1.map(function(a){ return a.val; }),
      name: num1, type: 'scatter', mode: 'lines+markers',
      line: { color: '#00e5ff', width: 2 },
      marker: { size: 5, color: '#00e5ff' }
    };
    var trace2 = {
      x: agg2.map(function(a){ return a.key; }),
      y: agg2.map(function(a){ return a.val; }),
      name: num2, type: 'scatter', mode: 'lines+markers',
      yaxis: 'y2',
      line: { color: '#ff6b6b', width: 2 },
      marker: { size: 5, color: '#ff6b6b' }
    };

    var layout = this.getLayoutBase();
    layout.title.text = num1 + ' vs ' + num2 + ' (Dual Axis)';
    layout.yaxis.title  = num1;
    layout.yaxis.titlefont = { color: '#00e5ff' };
    layout.yaxis2 = {
      title: num2, titlefont: { color: '#ff6b6b' },
      tickfont: { color: '#ff6b6b' },
      overlaying: 'y', side: 'right',
      gridcolor: 'rgba(45,55,72,0.3)', zerolinecolor: this.GRID
    };

    return { title: layout.title.text, chart_type: 'double_axis_chart',
             description: 'Dual Y-axis comparing ' + num1 + ' and ' + num2 + ' monthly trends.',
             plotly_json: { data: [trace1, trace2], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  14. PARETO CHART — bar + cumulative 80/20 line
  // ──────────────────────────────────────────────────────────
  paretoChart(df, catCol, numCol) {
    var agg = this.aggregate(df, catCol, numCol, false).slice(0, 15);
    if (agg.length < 2) return null;

    var total = 0;
    for (var i = 0; i < agg.length; i++) total += agg[i].val;
    var cumPct = [], running = 0;
    for (var j = 0; j < agg.length; j++) {
      running += agg[j].val;
      cumPct.push(Math.round(running / total * 10000) / 100);
    }

    var barTrace = {
      x: agg.map(function(a){ return a.key; }),
      y: agg.map(function(a){ return a.val; }),
      type: 'bar', name: numCol,
      marker: { color: '#4d96ff' }
    };
    var lineTrace = {
      x: agg.map(function(a){ return a.key; }),
      y: cumPct, type: 'scatter', mode: 'lines+markers',
      name: 'Cumulative %', yaxis: 'y2',
      line: { color: '#ff922b', width: 2 },
      marker: { size: 5, color: '#ff922b' }
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' Pareto Analysis';
    layout.yaxis.title  = numCol;
    layout.yaxis2 = {
      title: 'Cumulative %', overlaying: 'y', side: 'right',
      range: [0, 105], tickfont: { color: '#ff922b' }, titlefont: { color: '#ff922b' },
      gridcolor: 'rgba(45,55,72,0.2)', zerolinecolor: this.GRID
    };
    layout.xaxis.tickangle = -35;
    layout.shapes = [{
      type: 'line', x0: -0.5, x1: agg.length - 0.5, y0: 80, y1: 80, yref: 'y2',
      line: { color: '#ff6b6b', width: 1, dash: 'dash' }
    }];

    return { title: layout.title.text, chart_type: 'pareto_chart',
             description: 'Pareto (80/20) analysis of ' + numCol + ' by ' + catCol + '.',
             plotly_json: { data: [barTrace, lineTrace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  15. RADAR CHART — spider per category
  // ──────────────────────────────────────────────────────────
  radarChart(df, catCol, numCols) {
    if (!numCols || numCols.length < 3) return null;
    var cats = this.unique(df, catCol).slice(0, 5);
    if (cats.length < 2) return null;

    var self = this;
    // compute mean per cat per numCol and normalize to 0-100
    var maxes = {};
    for (var n = 0; n < numCols.length; n++) maxes[numCols[n]] = 0;

    var catData = {};
    for (var ci = 0; ci < cats.length; ci++) {
      catData[cats[ci]] = {};
      for (var ni = 0; ni < numCols.length; ni++) {
        var sum = 0, count = 0;
        for (var r = 0; r < df.length; r++) {
          if (String(df[r][catCol]) === String(cats[ci])) {
            var v = Number(df[r][numCols[ni]]);
            if (!isNaN(v)) { sum += v; count++; }
          }
        }
        var avg = count > 0 ? sum / count : 0;
        catData[cats[ci]][numCols[ni]] = avg;
        if (avg > maxes[numCols[ni]]) maxes[numCols[ni]] = avg;
      }
    }

    var traces = [];
    for (var k = 0; k < cats.length; k++) {
      var rVals = [], theta = [];
      for (var m = 0; m < numCols.length; m++) {
        theta.push(numCols[m]);
        var mx = maxes[numCols[m]] || 1;
        rVals.push(Math.round(catData[cats[k]][numCols[m]] / mx * 100));
      }
      // close the polygon
      rVals.push(rVals[0]);
      theta.push(theta[0]);

      traces.push({
        type: 'scatterpolar', r: rVals, theta: theta,
        fill: 'toself', fillcolor: self.COLORS[k % self.COLORS.length].replace(')', ',0.15)').replace('rgb', 'rgba').replace('#', ''),
        name: String(cats[k]),
        line: { color: self.COLORS[k % self.COLORS.length] }
      });
    }

    // Fix fillcolor — hex to rgba
    for (var ti = 0; ti < traces.length; ti++) {
      traces[ti].fillcolor = this._hexToRgba(self.COLORS[ti % self.COLORS.length], 0.15);
    }

    var layout = this.getLayoutBase();
    layout.title.text = 'Radar — ' + catCol + ' Comparison';
    layout.polar = {
      bgcolor: this.CARD,
      radialaxis:  { visible: true, range: [0, 100], gridcolor: this.GRID, tickfont: { color: this.TEXT, size: 9 } },
      angularaxis: { gridcolor: this.GRID, tickfont: { color: this.TEXT, size: 10 } }
    };
    // Remove cartesian axes
    delete layout.xaxis;
    delete layout.yaxis;

    return { title: layout.title.text, chart_type: 'radar_chart',
             description: 'Radar chart comparing ' + cats.length + ' categories across ' + numCols.length + ' metrics.',
             plotly_json: { data: traces, layout: layout } };
  },

  _hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  },

  // ──────────────────────────────────────────────────────────
  //  16. TREEMAP — proportional areas
  // ──────────────────────────────────────────────────────────
  treemapChart(df, catCol, numCol) {
    var agg = this.aggregate(df, catCol, numCol, false).slice(0, 20);
    if (agg.length < 2) return null;

    var labels = [''], parents = [''], values = [0];
    for (var i = 0; i < agg.length; i++) {
      labels.push(agg[i].key);
      parents.push('');
      values.push(agg[i].val);
    }

    var trace = {
      type: 'treemap',
      labels: labels, parents: parents, values: values,
      marker: { colors: [''].concat(this.COLORS.slice(0, agg.length)), line: { color: this.BG, width: 1 } },
      textinfo: 'label+value+percent root',
      hovertemplate: '<b>%{label}</b><br>Value: %{value:,.0f}<br>Share: %{percentRoot:.1%}<extra></extra>',
      branchvalues: 'total',
      root: { color: this.CARD }
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol + ' Treemap by ' + catCol;
    delete layout.xaxis; delete layout.yaxis;

    return { title: layout.title.text, chart_type: 'treemap_chart',
             description: 'Treemap showing proportional ' + numCol + ' by ' + catCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  17. SUNBURST — hierarchical
  // ──────────────────────────────────────────────────────────
  sunburstChart(df, parentCol, childCol, numCol) {
    // Build hierarchy: root → parent → child
    var pVals = this.unique(df, parentCol).slice(0, 8);
    if (pVals.length < 2) return null;

    var ids = [], labels = [], parents = [], values = [];
    // Add root
    ids.push('All'); labels.push('All'); parents.push(''); values.push(0);

    var parentTotals = {};
    for (var p = 0; p < pVals.length; p++) {
      parentTotals[pVals[p]] = 0;
    }

    // Aggregate child within parent
    var childAgg = {};
    for (var r = 0; r < df.length; r++) {
      var pVal = df[r][parentCol];
      var cVal = df[r][childCol];
      var nVal = Number(df[r][numCol]) || 0;
      if (!pVal || !cVal) continue;
      var key = pVal + '|||' + cVal;
      childAgg[key] = (childAgg[key] || 0) + nVal;
      if (parentTotals[pVal] !== undefined) parentTotals[pVal] += nVal;
    }

    // Add parents
    for (var pi = 0; pi < pVals.length; pi++) {
      ids.push('P_' + pVals[pi]);
      labels.push(String(pVals[pi]));
      parents.push('All');
      values.push(parentTotals[pVals[pi]] || 0);
    }

    // Add children (top 5 per parent)
    for (var pk = 0; pk < pVals.length; pk++) {
      var children = [];
      var childKeys = Object.keys(childAgg);
      for (var ck = 0; ck < childKeys.length; ck++) {
        if (childKeys[ck].indexOf(pVals[pk] + '|||') === 0) {
          var childName = childKeys[ck].split('|||')[1];
          children.push({ name: childName, val: childAgg[childKeys[ck]] });
        }
      }
      children.sort(function(a, b) { return b.val - a.val; });
      children = children.slice(0, 5);
      for (var ch = 0; ch < children.length; ch++) {
        ids.push('C_' + pVals[pk] + '_' + children[ch].name);
        labels.push(String(children[ch].name));
        parents.push('P_' + pVals[pk]);
        values.push(children[ch].val);
      }
    }

    if (labels.length < 5) return null;

    var trace = {
      type: 'sunburst',
      ids: ids,
      labels: labels, parents: parents, values: values,
      branchvalues: 'remainder',
      marker: { colors: this.COLORS, line: { color: this.BG, width: 1 } },
      hovertemplate: '<b>%{label}</b><br>Value: %{value:,.0f}<extra></extra>',
      textfont: { color: 'white' }
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Sunburst: ' + parentCol + ' → ' + childCol;
    delete layout.xaxis; delete layout.yaxis;

    return { title: layout.title.text, chart_type: 'sunburst_chart',
             description: 'Hierarchical sunburst of ' + numCol + ' by ' + parentCol + ' and ' + childCol + '.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  18. RFM CHART — K-Means clustering
  // ──────────────────────────────────────────────────────────

  /** Custom K-Means with StandardScaler normalization */
  standardScale(data) {
    var nFeatures = data[0].length;
    var means = [], stds = [];
    for (var f = 0; f < nFeatures; f++) {
      var sum = 0;
      for (var i = 0; i < data.length; i++) sum += data[i][f];
      var m = sum / data.length;
      var ssq = 0;
      for (var j = 0; j < data.length; j++) ssq += Math.pow(data[j][f] - m, 2);
      var s = Math.sqrt(ssq / data.length) || 1;
      means.push(m); stds.push(s);
    }
    var scaled = [];
    for (var r = 0; r < data.length; r++) {
      var row = [];
      for (var c = 0; c < nFeatures; c++) {
        row.push((data[r][c] - means[c]) / stds[c]);
      }
      scaled.push(row);
    }
    return scaled;
  },

  kMeans(data, k, maxIters) {
    if (maxIters === undefined) maxIters = 100;
    if (data.length <= k) {
      var trivial = [];
      for (var t = 0; t < data.length; t++) trivial.push(t % k);
      return trivial;
    }
    var nFeatures = data[0].length;

    // K-Means++ initialization
    var centroids = [data[Math.floor(Math.random() * data.length)].slice()];
    for (var ci = 1; ci < k; ci++) {
      var dists = [];
      var totalDist = 0;
      for (var di = 0; di < data.length; di++) {
        var minD = Infinity;
        for (var cc = 0; cc < centroids.length; cc++) {
          var d2 = 0;
          for (var ff = 0; ff < nFeatures; ff++) d2 += Math.pow(data[di][ff] - centroids[cc][ff], 2);
          if (d2 < minD) minD = d2;
        }
        dists.push(minD);
        totalDist += minD;
      }
      // Weighted random pick
      var rnd = Math.random() * totalDist;
      var cumSum = 0;
      for (var pi = 0; pi < dists.length; pi++) {
        cumSum += dists[pi];
        if (cumSum >= rnd) { centroids.push(data[pi].slice()); break; }
      }
    }

    var assignments = new Array(data.length);
    for (var iter = 0; iter < maxIters; iter++) {
      var changed = false;
      for (var i = 0; i < data.length; i++) {
        var minDist = Infinity, cluster = 0;
        for (var j = 0; j < k; j++) {
          var dist = 0;
          for (var f2 = 0; f2 < nFeatures; f2++) dist += Math.pow(data[i][f2] - centroids[j][f2], 2);
          if (dist < minDist) { minDist = dist; cluster = j; }
        }
        if (assignments[i] !== cluster) { assignments[i] = cluster; changed = true; }
      }
      if (!changed) break;
      // Recompute centroids
      var newC = [];
      var counts = [];
      for (var jj = 0; jj < k; jj++) {
        var arr = [];
        for (var ff2 = 0; ff2 < nFeatures; ff2++) arr.push(0);
        newC.push(arr);
        counts.push(0);
      }
      for (var ii = 0; ii < data.length; ii++) {
        var cl = assignments[ii];
        counts[cl]++;
        for (var f3 = 0; f3 < nFeatures; f3++) newC[cl][f3] += data[ii][f3];
      }
      for (var jk = 0; jk < k; jk++) {
        if (counts[jk] > 0) {
          for (var f4 = 0; f4 < nFeatures; f4++) centroids[jk][f4] = newC[jk][f4] / counts[jk];
        }
      }
    }
    return assignments;
  },

  rfmChart(df, custCol, dateCol, valueCol) {
    var customers = {};
    var now = new Date();
    for (var i = 0; i < df.length; i++) {
      var row = df[i];
      var c = row[custCol];
      var d = new Date(row[dateCol]);
      var v = Number(row[valueCol]) || 0;
      if (c && !isNaN(d) && v) {
        if (!customers[c]) customers[c] = { recency: d, freq: 0, monetary: 0 };
        if (d > customers[c].recency) customers[c].recency = d;
        customers[c].freq += 1;
        customers[c].monetary += v;
      }
    }

    var keys = Object.keys(customers);
    if (keys.length < 20) return null;

    var rfmData = [];
    for (var k = 0; k < keys.length; k++) {
      var cu = customers[keys[k]];
      rfmData.push([(now - cu.recency) / (1000 * 60 * 60 * 24), cu.freq, cu.monetary]);
    }

    // StandardScaler normalization
    var normalized = this.standardScale(rfmData);
    var nClusters = Math.min(4, keys.length);
    var clusters = this.kMeans(normalized, nClusters);

    var segNames = ['Champions', 'Loyal', 'At Risk', 'Lost'];
    // Sort segments by avg monetary descending to assign meaningful names
    var clusterMonetary = {};
    for (var ci2 = 0; ci2 < nClusters; ci2++) clusterMonetary[ci2] = { sum: 0, count: 0 };
    for (var ri = 0; ri < keys.length; ri++) {
      clusterMonetary[clusters[ri]].sum += rfmData[ri][2];
      clusterMonetary[clusters[ri]].count += 1;
    }
    var ranked = [];
    for (var rk = 0; rk < nClusters; rk++) {
      ranked.push({ idx: rk, avg: clusterMonetary[rk].count > 0 ? clusterMonetary[rk].sum / clusterMonetary[rk].count : 0 });
    }
    ranked.sort(function(a, b) { return b.avg - a.avg; });
    var clusterToSeg = {};
    for (var s = 0; s < ranked.length; s++) clusterToSeg[ranked[s].idx] = segNames[s] || 'Segment ' + s;

    var self = this;
    var maxF = 1;
    for (var mi = 0; mi < rfmData.length; mi++) {
      if (rfmData[mi][1] > maxF) maxF = rfmData[mi][1];
    }

    var trace = {
      x: rfmData.map(function(d) { return d[0]; }),
      y: rfmData.map(function(d) { return d[2]; }),
      mode: 'markers',
      marker: {
        size: rfmData.map(function(d) { return Math.max(5, (d[1] / maxF) * 20); }),
        color: clusters.map(function(c) { return self.COLORS[c % self.COLORS.length]; }),
        opacity: 0.7
      },
      text: keys.map(function(k2, idx) {
        return '<b>' + k2 + '</b><br>Segment: ' + clusterToSeg[clusters[idx]] +
               '<br>Recency: ' + rfmData[idx][0].toFixed(0) + 'd' +
               '<br>Freq: ' + rfmData[idx][1] +
               '<br>Value: ' + rfmData[idx][2].toFixed(0);
      }),
      hovertemplate: '%{text}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'RFM Customer Segmentation';
    layout.xaxis.title = 'Recency (Days)';
    layout.yaxis.title = 'Monetary Value';

    return { title: layout.title.text, chart_type: 'rfm_chart',
             description: 'K-Means clustered RFM analysis (' + keys.length + ' customers, ' + nClusters + ' segments).',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  19. MARKET BASKET — Apriori from scratch
  // ──────────────────────────────────────────────────────────

  /**
   * Apriori Market Basket Analysis
   *
   * Steps:
   *  1. Build transactions grouped by custCol
   *  2. Find frequent 1-itemsets (support >= minSupport)
   *  3. Generate candidate 2-itemsets from frequent 1-itemsets
   *  4. Filter by minSupport
   *  5. Generate rules: support(A∪B), confidence, lift
   *  6. Filter by lift >= 1.0
   *  7. Plot as scatter: confidence vs support, size=lift
   */
  marketBasketChart(df, custCol, productCol) {
    var minSupport = 0.02;
    var minLift = 1.0;

    // 1. Build transactions
    var txMap = {};
    for (var i = 0; i < df.length; i++) {
      var cust = df[i][custCol];
      var prod = df[i][productCol];
      if (!cust || !prod) continue;
      if (!txMap[cust]) txMap[cust] = {};
      txMap[cust][prod] = true;
    }
    var txKeys = Object.keys(txMap);
    var totalTx = txKeys.length;
    if (totalTx < 20) return null;

    // Convert to arrays of sets
    var transactions = [];
    for (var t = 0; t < txKeys.length; t++) {
      transactions.push(Object.keys(txMap[txKeys[t]]));
    }

    // 2. Count support for each item
    var itemCounts = {};
    for (var ti = 0; ti < transactions.length; ti++) {
      for (var j = 0; j < transactions[ti].length; j++) {
        var item = transactions[ti][j];
        itemCounts[item] = (itemCounts[item] || 0) + 1;
      }
    }

    // Frequent 1-itemsets
    var freq1 = [];
    var allItems = Object.keys(itemCounts);
    for (var fi = 0; fi < allItems.length; fi++) {
      if (itemCounts[allItems[fi]] / totalTx >= minSupport) {
        freq1.push(allItems[fi]);
      }
    }
    freq1.sort();

    if (freq1.length < 2) return null;

    // 3. Generate candidate 2-itemsets and count
    var pairCounts = {};
    for (var tx = 0; tx < transactions.length; tx++) {
      var basket = transactions[tx];
      // Only look at frequent items in basket
      var inBasket = [];
      for (var bi = 0; bi < basket.length; bi++) {
        if (itemCounts[basket[bi]] / totalTx >= minSupport) inBasket.push(basket[bi]);
      }
      inBasket.sort();
      for (var a = 0; a < inBasket.length; a++) {
        for (var b = a + 1; b < inBasket.length; b++) {
          var pairKey = inBasket[a] + '|||' + inBasket[b];
          pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
        }
      }
    }

    // 4. Filter by minSupport, generate rules
    var rules = [];
    var pairKeys = Object.keys(pairCounts);
    for (var pk = 0; pk < pairKeys.length; pk++) {
      var supportAB = pairCounts[pairKeys[pk]] / totalTx;
      if (supportAB < minSupport) continue;

      var parts = pairKeys[pk].split('|||');
      var itemA = parts[0], itemB = parts[1];
      var supportA = itemCounts[itemA] / totalTx;
      var supportB = itemCounts[itemB] / totalTx;

      // Rule A → B
      var confAB = supportAB / supportA;
      var liftAB = confAB / supportB;
      if (liftAB >= minLift) {
        rules.push({ antecedent: itemA, consequent: itemB,
                      support: supportAB, confidence: confAB, lift: liftAB });
      }

      // Rule B → A
      var confBA = supportAB / supportB;
      var liftBA = confBA / supportA;
      if (liftBA >= minLift) {
        rules.push({ antecedent: itemB, consequent: itemA,
                      support: supportAB, confidence: confBA, lift: liftBA });
      }
    }

    if (rules.length < 1) return null;

    // Sort by lift desc, take top 50
    rules.sort(function(a, b) { return b.lift - a.lift; });
    rules = rules.slice(0, 50);

    var maxLift = rules[0].lift;
    var self = this;

    var trace = {
      x: rules.map(function(r) { return r.support; }),
      y: rules.map(function(r) { return r.confidence; }),
      mode: 'markers',
      marker: {
        size: rules.map(function(r) { return Math.max(6, (r.lift / maxLift) * 30); }),
        color: rules.map(function(r) { return r.lift; }),
        colorscale: [[0, '#4d96ff'], [0.5, '#ffd93d'], [1, '#ff6b6b']],
        colorbar: { title: 'Lift', tickfont: { color: self.TEXT }, titlefont: { color: self.TEXT } },
        opacity: 0.8
      },
      text: rules.map(function(r) {
        return '<b>' + r.antecedent + ' → ' + r.consequent + '</b>' +
               '<br>Support: ' + (r.support * 100).toFixed(1) + '%' +
               '<br>Confidence: ' + (r.confidence * 100).toFixed(1) + '%' +
               '<br>Lift: ' + r.lift.toFixed(2);
      }),
      hovertemplate: '%{text}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Market Basket Analysis (Apriori)';
    layout.xaxis.title = 'Support';
    layout.yaxis.title = 'Confidence';

    return { title: layout.title.text, chart_type: 'market_basket',
             description: 'Apriori association rules: ' + rules.length + ' rules found (min_support=0.02, min_lift=1.0). ' + totalTx + ' transactions analyzed.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  20. COHORT RETENTION HEATMAP
  // ──────────────────────────────────────────────────────────
  cohortRetention(df, custCol, dateCol) {
    // Group customers by their first-purchase month (cohort)
    var firstPurchase = {};
    var custMonths = {};
    for (var i = 0; i < df.length; i++) {
      var c = df[i][custCol];
      var d = new Date(df[i][dateCol]);
      if (!c || isNaN(d)) continue;
      var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!firstPurchase[c] || ym < firstPurchase[c]) firstPurchase[c] = ym;
      if (!custMonths[c]) custMonths[c] = {};
      custMonths[c][ym] = true;
    }

    var customers = Object.keys(firstPurchase);
    if (customers.length < 20) return null;

    // Cohort → list of unique months each customer was active
    var cohorts = {};
    for (var ci = 0; ci < customers.length; ci++) {
      var cust = customers[ci];
      var cohort = firstPurchase[cust];
      if (!cohorts[cohort]) cohorts[cohort] = [];
      cohorts[cohort].push(Object.keys(custMonths[cust]).sort());
    }

    var cohortNames = Object.keys(cohorts).sort();
    if (cohortNames.length < 2) return null;

    // Get all unique months sorted
    var allMonths = {};
    for (var co = 0; co < cohortNames.length; co++) {
      allMonths[cohortNames[co]] = true;
      var members = cohorts[cohortNames[co]];
      for (var mb = 0; mb < members.length; mb++) {
        for (var mm = 0; mm < members[mb].length; mm++) allMonths[members[mb][mm]] = true;
      }
    }
    var sortedMonths = Object.keys(allMonths).sort();

    // Build retention matrix (max 12 periods)
    var maxPeriods = Math.min(12, sortedMonths.length);
    var z = [], yLabels = [], xLabels = [];

    for (var p = 0; p < maxPeriods; p++) xLabels.push('M+' + p);

    // Limit to last 12 cohorts
    var displayCohorts = cohortNames.slice(-12);

    var annotations = [];
    for (var dc = 0; dc < displayCohorts.length; dc++) {
      var cohortKey = displayCohorts[dc];
      yLabels.push(cohortKey);
      var members2 = cohorts[cohortKey];
      var total = members2.length;
      var row = [];

      // Find index of cohort month in sortedMonths
      var cohortIdx = sortedMonths.indexOf(cohortKey);

      for (var period = 0; period < maxPeriods; period++) {
        var targetMonth = sortedMonths[cohortIdx + period];
        if (!targetMonth) { row.push(0); continue; }
        var retained = 0;
        for (var m2 = 0; m2 < members2.length; m2++) {
          if (members2[m2].indexOf(targetMonth) >= 0) retained++;
        }
        var pct = Math.round(retained / total * 100);
        row.push(pct);
        annotations.push({
          x: xLabels[period], y: cohortKey, text: pct + '%',
          font: { color: pct > 50 ? 'white' : this.TEXT, size: 9 },
          showarrow: false
        });
      }
      z.push(row);
    }

    if (z.length < 2) return null;

    var trace = {
      z: z, x: xLabels, y: yLabels, type: 'heatmap',
      colorscale: [[0, '#161a24'], [0.5, '#4d96ff'], [1, '#00e5ff']],
      hovertemplate: 'Cohort %{y}<br>Period %{x}: %{z}% retained<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'Cohort Retention Analysis';
    layout.annotations = annotations;
    layout.yaxis.title = 'Cohort';
    layout.xaxis.title = 'Period';

    return { title: layout.title.text, chart_type: 'cohort_retention',
             description: 'Cohort retention heatmap showing customer retention rates over time.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  21. BCG MATRIX — Growth vs Share
  // ──────────────────────────────────────────────────────────
  bcgMatrix(df, productCol, valueCol, dateCol) {
    // Calculate market share (% of total) and growth rate per product
    var productTotals = {};
    var productByMonth = {};
    var grandTotal = 0;

    for (var i = 0; i < df.length; i++) {
      var prod = df[i][productCol];
      var val  = Number(df[i][valueCol]) || 0;
      var d    = new Date(df[i][dateCol]);
      if (!prod || isNaN(d)) continue;
      var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

      productTotals[prod] = (productTotals[prod] || 0) + val;
      grandTotal += val;

      if (!productByMonth[prod]) productByMonth[prod] = {};
      productByMonth[prod][ym] = (productByMonth[prod][ym] || 0) + val;
    }

    var products = Object.keys(productTotals);
    if (products.length < 3 || grandTotal === 0) return null;

    // Calculate growth rate: compare first half vs second half of months
    var xData = [], yData = [], sizeData = [], labels = [], colors = [];
    var self = this;

    for (var pi = 0; pi < products.length; pi++) {
      var prod2 = products[pi];
      var share = (productTotals[prod2] / grandTotal) * 100;

      // Growth: compare last period vs first period
      var months = Object.keys(productByMonth[prod2]).sort();
      var growth = 0;
      if (months.length >= 2) {
        var mid = Math.floor(months.length / 2);
        var firstHalf = 0, secondHalf = 0;
        for (var fh = 0; fh < mid; fh++) firstHalf += productByMonth[prod2][months[fh]];
        for (var sh = mid; sh < months.length; sh++) secondHalf += productByMonth[prod2][months[sh]];
        if (firstHalf > 0) growth = ((secondHalf - firstHalf) / firstHalf) * 100;
      }

      xData.push(share);
      yData.push(growth);
      sizeData.push(Math.max(8, Math.sqrt(productTotals[prod2] / grandTotal) * 60));
      labels.push(prod2);

      // Quadrant coloring: Stars, Cash Cows, Question Marks, Dogs
      if (share >= 10 && growth >= 0)       colors.push('#6bcb77');  // Star
      else if (share >= 10 && growth < 0)   colors.push('#4d96ff');  // Cash Cow
      else if (share < 10 && growth >= 0)   colors.push('#ffd93d');  // Question Mark
      else                                   colors.push('#ff6b6b');  // Dog
    }

    var trace = {
      x: xData, y: yData, mode: 'markers+text',
      marker: { size: sizeData, color: colors, opacity: 0.7, line: { color: 'white', width: 1 } },
      text: labels, textposition: 'top center',
      textfont: { color: this.TEXT, size: 9 },
      hovertemplate: '<b>%{text}</b><br>Market Share: %{x:.1f}%<br>Growth: %{y:.1f}%<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = 'BCG Growth-Share Matrix';
    layout.xaxis.title = 'Relative Market Share (%)';
    layout.yaxis.title = 'Growth Rate (%)';
    layout.shapes = [
      { type: 'line', x0: 10, x1: 10, y0: -100, y1: 200, line: { color: this.GRID, width: 1, dash: 'dash' } },
      { type: 'line', x0: 0, x1: 100, y0: 0, y1: 0, line: { color: this.GRID, width: 1, dash: 'dash' } }
    ];
    // Quadrant labels
    layout.annotations = [
      { x: 0.95, y: 0.95, xref: 'paper', yref: 'paper', text: '⭐ Stars', showarrow: false, font: { color: '#6bcb77', size: 12 } },
      { x: 0.95, y: 0.05, xref: 'paper', yref: 'paper', text: '🐄 Cash Cows', showarrow: false, font: { color: '#4d96ff', size: 12 } },
      { x: 0.05, y: 0.95, xref: 'paper', yref: 'paper', text: '❓ Question Marks', showarrow: false, font: { color: '#ffd93d', size: 12 } },
      { x: 0.05, y: 0.05, xref: 'paper', yref: 'paper', text: '🐕 Dogs', showarrow: false, font: { color: '#ff6b6b', size: 12 } }
    ];

    return { title: layout.title.text, chart_type: 'bcg_matrix',
             description: 'BCG matrix showing product portfolio positioning by growth rate and market share.',
             plotly_json: { data: [trace], layout: layout } };
  },

  // ──────────────────────────────────────────────────────────
  //  22. SCATTER CHART — 2 numeric columns
  // ──────────────────────────────────────────────────────────
  scatterChart(df, numCol1, numCol2) {
    var x = [], y = [];
    for (var i = 0; i < df.length; i++) {
      var vx = Number(df[i][numCol1]);
      var vy = Number(df[i][numCol2]);
      if (!isNaN(vx) && !isNaN(vy)) { x.push(vx); y.push(vy); }
    }
    if (x.length < 10) return null;

    // Sample if too large
    if (x.length > 2000) {
      var step = Math.ceil(x.length / 2000);
      var sx = [], sy = [];
      for (var s = 0; s < x.length; s += step) { sx.push(x[s]); sy.push(y[s]); }
      x = sx; y = sy;
    }

    var trace = {
      x: x, y: y, mode: 'markers',
      marker: { color: '#00e5ff', size: 5, opacity: 0.5 },
      hovertemplate: numCol1 + ': %{x:,.1f}<br>' + numCol2 + ': %{y:,.1f}<extra></extra>'
    };

    var layout = this.getLayoutBase();
    layout.title.text = numCol1 + ' vs ' + numCol2;
    layout.xaxis.title = numCol1;
    layout.yaxis.title = numCol2;

    return { title: layout.title.text, chart_type: 'scatter_chart',
             description: 'Scatter plot of ' + numCol1 + ' vs ' + numCol2 + ' (' + x.length + ' points).',
             plotly_json: { data: [trace], layout: layout } };
  }
};
