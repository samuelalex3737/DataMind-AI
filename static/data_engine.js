/**
 * DataMind AI - Client-side Data Engine
 * Replaces the Python pandas backend for 100% client-side processing.
 */

window.DataEngine = {
  raw_data: [],
  clean_data: [],
  columns: [],
  dtypes: {},
  eda_results: {},

  async loadCSV(file) {
    return new Promise((resolve, reject) => {
      let limitHit = false;
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        preview: 100000,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            return reject("Error parsing CSV. Please ensure the file is valid.");
          }
          
          let data = results.data;
          let cols = results.meta.fields;
          
          if (!cols || cols.length < 2 || data.length < 10) {
            return reject("Invalid CSV structure: Must have at least 2 columns and 10 rows for analysis.");
          }

          if (cols.length > 100) {
            limitHit = true;
            cols = cols.slice(0, 100);
            data = data.map(row => {
               let newRow = {};
               cols.forEach(c => newRow[c] = row[c]);
               return newRow;
            });
          }
          
          if (data.length === 100000) {
             limitHit = true;
          }

          this.raw_data = data;
          this.columns = cols;
          
          if (limitHit && typeof window.showToast === 'function') {
            setTimeout(() => {
              window.showToast('Large dataset detected. Capped at 100k rows and 100 columns for performance.', 'error');
            }, 1000);
          }
          
          resolve(this.raw_data);
        },
        error: reject
      });
    });
  },

  inferTypes() {
    this.dtypes = {};
    const sampleSize = Math.min(100, this.raw_data.length);
    
    this.columns.forEach(col => {
      let numCount = 0;
      let dateCount = 0;
      let validCount = 0;

      for (let i = 0; i < sampleSize; i++) {
        let val = this.raw_data[i][col];
        if (val === null || val === undefined || val === '') continue;
        validCount++;
        
        val = String(val).trim();
        // Check numeric
        if (!isNaN(Number(val)) && val !== "") {
          numCount++;
        } 
        // Check date
        else if (val.length > 5 && !isNaN(Date.parse(val)) && !/^\d+$/.test(val)) {
          dateCount++;
        }
      }

      if (validCount === 0) {
        this.dtypes[col] = 'object';
      } else if (numCount / validCount > 0.8) {
        this.dtypes[col] = 'numeric';
      } else if (dateCount / validCount > 0.8) {
        this.dtypes[col] = 'datetime';
      } else {
        this.dtypes[col] = 'object';
      }
    });
  },

  runEDA() {
    this.inferTypes();
    
    // 1. Initial State
    let df = JSON.parse(JSON.stringify(this.raw_data)); // deep copy
    let totalCells = df.length * this.columns.length;
    let missingBefore = 0;
    
    // Count missing before
    df.forEach(row => {
      this.columns.forEach(col => {
        if (row[col] === null || row[col] === undefined || row[col] === '') missingBefore++;
      });
    });

    // 2. Type casting & Capitalization
    let type_fixes = [];
    let normalised_columns = [];
    
    this.columns.forEach(col => {
      let changedCasing = false;
      df.forEach(row => {
        let val = row[col];
        if (val === null || val === undefined || val === '') return;
        
        if (this.dtypes[col] === 'numeric') {
          row[col] = Number(val);
        } else if (this.dtypes[col] === 'object') {
          let strVal = String(val).trim();
          let titleVal = strVal.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          if (strVal !== titleVal) changedCasing = true;
          row[col] = titleVal;
        } else if (this.dtypes[col] === 'datetime') {
          row[col] = new Date(val).toISOString();
        }
      });
      if (changedCasing) normalised_columns.push(col);
    });

    // 3. Handle Missing Values
    let strategies = {};
    this.columns.forEach(col => {
      let missingInCol = 0;
      df.forEach(row => {
        if (row[col] === null || row[col] === undefined || row[col] === '') missingInCol++;
      });
      
      if (missingInCol > 0) {
        if (this.dtypes[col] === 'datetime') {
          // ffill then bfill
          let lastValid = null;
          for (let i = 0; i < df.length; i++) {
            if (df[i][col]) lastValid = df[i][col];
            else if (lastValid) df[i][col] = lastValid;
          }
          let firstValid = null;
          for (let i = df.length - 1; i >= 0; i--) {
            if (df[i][col]) firstValid = df[i][col];
            else if (firstValid) df[i][col] = firstValid;
          }
          strategies[col] = 'forward-fill (then back-fill)';
        } else if (this.dtypes[col] === 'numeric') {
          // median
          let vals = df.map(r => r[col]).filter(v => typeof v === 'number' && !isNaN(v)).sort((a,b) => a-b);
          let median = vals.length > 0 ? vals[Math.floor(vals.length/2)] : 0;
          df.forEach(r => { if (r[col] === null || r[col] === undefined || r[col] === '') r[col] = median; });
          strategies[col] = `median (${median.toFixed(2)})`;
        } else {
          // mode
          let counts = {};
          df.forEach(r => {
            let v = r[col];
            if (v) counts[v] = (counts[v] || 0) + 1;
          });
          let mode = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
          let fillVal = mode || "Unknown";
          df.forEach(r => { if (r[col] === null || r[col] === undefined || r[col] === '') r[col] = fillVal; });
          strategies[col] = `mode ('${fillVal}')`;
        }
      }
    });

    // 3b. Count missing AFTER imputation
    let missingAfter = 0;
    df.forEach(row => {
      this.columns.forEach(col => {
        if (row[col] === null || row[col] === undefined || row[col] === '') missingAfter++;
      });
    });

    // 4. Duplicates
    let seen = new Set();
    let uniqueDf = [];
    df.forEach(row => {
      let str = JSON.stringify(row);
      if (!seen.has(str)) {
        seen.add(str);
        uniqueDf.push(row);
      }
    });
    let dupCount = df.length - uniqueDf.length;
    df = uniqueDf;

    // 5. Outliers (IQR)
    let outliers = {};
    let uniqueOutlierRows = new Set();
    this.columns.forEach(col => {
      if (this.dtypes[col] === 'numeric') {
        let vals = df.map(r => r[col]).sort((a,b) => a-b);
        if (vals.length < 4) return;
        let q1 = vals[Math.floor(vals.length * 0.25)];
        let q3 = vals[Math.floor(vals.length * 0.75)];
        let iqr = q3 - q1;
        let lower = q1 - 1.5 * iqr;
        let upper = q3 + 1.5 * iqr;
        
        let count = 0;
        df.forEach((row, i) => {
          let v = row[col];
          if (v < lower || v > upper) {
            count++;
            uniqueOutlierRows.add(i);
            row[`_${col}_outlier`] = true;
          } else {
            row[`_${col}_outlier`] = false;
          }
        });
        
        if (count > 0) {
          outliers[col] = {
            count: count,
            percentage: (count / df.length * 100).toFixed(1),
            lower_bound: lower, upper_bound: upper, IQR: iqr
          };
        }
      }
    });

    // 6. Summary Stats
    let stats = {};
    this.columns.forEach(col => {
      if (this.dtypes[col] === 'numeric') {
        let vals = df.map(r => r[col]);
        let sum = vals.reduce((a,b)=>a+b, 0);
        let mean = sum / vals.length;
        let sorted = [...vals].sort((a,b)=>a-b);
        stats[col] = {
          count: vals.length,
          mean: mean,
          std: Math.sqrt(vals.map(x => Math.pow(x - mean, 2)).reduce((a,b)=>a+b, 0) / vals.length),
          min: sorted[0],
          '25%': sorted[Math.floor(vals.length * 0.25)],
          '50%': sorted[Math.floor(vals.length * 0.50)],
          '75%': sorted[Math.floor(vals.length * 0.75)],
          max: sorted[sorted.length-1]
        };
      }
    });

    this.clean_data = df;
    
    this.eda_results = {
      shape: { rows: this.raw_data.length, columns: this.columns.length, memory_usage_mb: ((JSON.stringify(this.raw_data).length)/1024/1024).toFixed(2) },
      dtypes: this.dtypes,
      missing_values: { total_before: missingBefore, total_after: missingAfter, strategies: strategies },
      duplicates: { found: dupCount, removed: dupCount, rows_before: this.raw_data.length, rows_after: df.length },
      capitalisation: { normalised_columns: normalised_columns },
      type_fixes: [],
      outliers: outliers,
      total_unique_outlier_rows: uniqueOutlierRows.size,
      summary_stats: stats
    };
    
    return this.eda_results;
  }
};
