"""
DataMind AI — Flask Backend
Complete API server for the AI Data Analyst application.
"""

import os
import io
import time
import json
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from datasets import generate_retail_dataset, generate_ecommerce_dataset
from eda import run_full_eda
from charts import generate_all_charts, generate_forecast, generate_whatif_chart
from ai_analyst import (chat_with_analyst, generate_key_insights,
                        generate_forecast_commentary, build_dataset_summary)

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max upload

# Handle file-too-large error with JSON response (not HTML)
@app.errorhandler(413)
def too_large(e):
    return jsonify({"success": False, "error": "File too large. Maximum upload size is 500MB."}), 413

# Custom JSON encoder to handle NaN/Infinity values
import math
from flask.json.provider import DefaultJSONProvider

class SafeJSONProvider(DefaultJSONProvider):
    """JSON provider that converts NaN/Infinity to None for safe serialization."""
    def default(self, o):
        if isinstance(o, float):
            if math.isnan(o) or math.isinf(o):
                return None
        return super().default(o)

    def dumps(self, obj, **kwargs):
        def sanitize(o):
            if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
                return None
            if isinstance(o, dict):
                return {k: sanitize(v) for k, v in o.items()}
            if isinstance(o, (list, tuple)):
                return [sanitize(v) for v in o]
            return o
        return super().dumps(sanitize(obj), **kwargs)

app.json_provider_class = SafeJSONProvider
app.json = SafeJSONProvider(app)

# In-memory storage (single-user mode)
store = {
    "df": None,
    "df_clean": None,
    "eda_results": None,
    "dataset_name": None,
    "chat_history": [],
    "charts_cache": None,
    "dataset_summary": None
}


def _df_to_json_safe(df, n=10):
    """Convert DataFrame head to JSON-safe format."""
    sample = df.head(n).copy()
    for col in sample.columns:
        if pd.api.types.is_datetime64_any_dtype(sample[col]):
            sample[col] = sample[col].astype(str)
    # Replace NaN with None for safe JSON serialization
    sample = sample.where(sample.notna(), None)
    return sample.to_dict(orient='records')


def _build_aggregated_context(df, eda):
    """
    Build a rich pre-aggregated context for the AI instead of raw sample rows.
    This allows the AI to answer questions about the full dataset accurately.
    """
    lines = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object']).columns.tolist()
    date_cols = [c for c in df.columns
                 if pd.api.types.is_datetime64_any_dtype(df[c])]

    lines.append(f"FULL DATASET SIZE: {len(df)} rows × {len(df.columns)} columns")

    # Per numeric column: totals + grouped breakdowns by each categorical column
    for num_col in num_cols[:6]:
        total = df[num_col].sum()
        mean = df[num_col].mean()
        lines.append(f"\n{num_col}: total={total:,.2f}, mean={mean:,.2f}, "
                     f"min={df[num_col].min():,.2f}, max={df[num_col].max():,.2f}")
        for cat_col in cat_cols[:4]:
            if df[cat_col].nunique() <= 20:
                grp = df.groupby(cat_col)[num_col].sum().sort_values(ascending=False)
                top3 = ', '.join([f"{k}={v:,.0f}" for k, v in grp.head(3).items()])
                bot3 = ', '.join([f"{k}={v:,.0f}" for k, v in grp.tail(3).items()])
                lines.append(f"  by {cat_col} — Best: {top3} | Worst: {bot3}")

    # Monthly trend if date column exists
    for date_col in date_cols[:1]:
        if num_cols:
            try:
                monthly = df.set_index(date_col).resample('ME')[num_cols[0]].sum()
                lines.append(f"\nMonthly {num_cols[0]}: "
                             f"min month={monthly.min():,.0f}, "
                             f"max month={monthly.max():,.0f}, "
                             f"over {len(monthly)} months")
            except Exception:
                pass

    return "\n".join(lines)


@app.route('/api/health')
def health_check():
    return jsonify({"status": "ok"})


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_csv():
    """Handle CSV file upload."""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400
    
    if not file.filename.lower().endswith('.csv'):
        return jsonify({"success": False, "error": "Only CSV files are supported"}), 400
    
    try:
        raw = file.read()
        
        # Try multiple encodings
        df = None
        for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(io.StringIO(raw.decode(encoding)))
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        
        if df is None:
            return jsonify({"success": False, "error": "Could not decode the CSV file. Please ensure it is saved in UTF-8 encoding."}), 400
        
        if df.empty:
            return jsonify({"success": False, "error": "The uploaded CSV is empty"}), 400
        
        store["df"] = df
        store["df_clean"] = None
        store["dataset_summary"] = None
        store["dataset_name"] = secure_filename(file.filename).rsplit('.', 1)[0]
        store["chat_history"] = []
        store["charts_cache"] = None
        store["eda_results"] = None
        store["df_clean"] = None
        store["dataset_summary"] = None
        
        return jsonify({
            "success": True,
            "name": store["dataset_name"],
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns),
            "dtypes": {str(k): str(v) for k, v in df.dtypes.items()},
            "sample": _df_to_json_safe(df, 10)
        })
    except MemoryError:
        return jsonify({"success": False, "error": "File is too large to process in memory. Try a smaller dataset."}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to parse CSV: {str(e)}"}), 400


@app.route('/api/preview', methods=['GET'])
def get_preview():
    """Get preview of currently loaded dataset."""
    if store["df"] is None:
        return jsonify({"error": "No dataset loaded"}), 400
    df = store["df"]
    return jsonify({
        "success": True,
        "name": store["dataset_name"],
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "dtypes": {str(k): str(v) for k, v in df.dtypes.items()},
        "sample": _df_to_json_safe(df, 10)
    })


@app.route('/api/generate', methods=['POST'])
def generate_dataset():
    """Generate a simulated dataset."""
    data = request.get_json()
    dataset_type = data.get("type", "retail") if data else "retail"
    
    try:
        if dataset_type == "ecommerce":
            df = generate_ecommerce_dataset()
            name = "E-Commerce Orders"
        else:
            df = generate_retail_dataset()
            name = "Retail Sales"
        
        store["df"] = df
        store["dataset_name"] = name
        store["chat_history"] = []
        store["charts_cache"] = None
        store["eda_results"] = None
        store["df_clean"] = None
        store["dataset_summary"] = None
        
        return jsonify({
            "success": True,
            "name": name,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns),
            "dtypes": {str(k): str(v) for k, v in df.dtypes.items()},
            "sample": _df_to_json_safe(df, 10)
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate dataset: {str(e)}"}), 500


@app.route('/api/eda', methods=['GET'])
def run_eda():
    """Run EDA pipeline on the loaded dataset."""
    if store["df"] is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    try:
        eda_results, df_clean = run_full_eda(store["df"])
        store["eda_results"] = eda_results
        store["df_clean"] = df_clean
        
        # Build dataset summary for AI context
        store["dataset_summary"] = build_dataset_summary(
            eda_results.get("shape", {}), eda_results
        )
        
        return jsonify({
            "success": True,
            "results": eda_results
        })
    except Exception as e:
        return jsonify({"error": f"EDA failed: {str(e)}"}), 500


@app.route('/api/date-range')
def date_range():
    """Return the actual minimum and maximum dates found in the dataset."""
    df = store.get('df_clean')
    
    if df is None:
        return jsonify({'min': None, 'max': None})
        
    date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    if not date_cols:
        return jsonify({'min': None, 'max': None})
        
    date_col = date_cols[0]
    # Ensure it's correctly parsed
    df[date_col] = pd.to_datetime(df[date_col], infer_datetime_format=True, errors='coerce')
    
    return jsonify({
        'min': str(df[date_col].min().date()) if pd.notna(df[date_col].min()) else None,
        'max': str(df[date_col].max().date()) if pd.notna(df[date_col].max()) else None
    })


@app.route('/api/charts', methods=['GET'])
def get_charts():
    """Generate all relevant charts."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    if date_from or date_to:
        date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
        if date_cols:
            date_col = date_cols[0]
            if date_from:
                df = df[df[date_col] >= pd.to_datetime(date_from)]
            if date_to:
                df = df[df[date_col] <= pd.to_datetime(date_to)]
    
    try:
        charts = generate_all_charts(df, store.get("eda_results"))
        store["charts_cache"] = charts
        
        return jsonify({
            "success": True,
            "charts": charts,
            "count": len(charts)
        })
    except Exception as e:
        return jsonify({"error": f"Chart generation failed: {str(e)}"}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """AI chat analyst endpoint."""
    data = request.get_json()
    if not data or not data.get("question"):
        return jsonify({"error": "No question provided"}), 400
    
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    question = data["question"]
    
    # Build dataset context
    summary = store.get("dataset_summary", "")
    if not summary and store.get("eda_results"):
        summary = build_dataset_summary(
            store["eda_results"].get("shape", {}), store["eda_results"]
        )
    
    # Use aggregated context instead of raw sample rows
    agg_context = _build_aggregated_context(df, store.get("eda_results", {}))

    result = chat_with_analyst(question, summary, store["chat_history"], agg_context)
    
    # Update chat history
    store["chat_history"].append({"role": "user", "content": question})
    store["chat_history"].append({"role": "assistant", "content": result["answer"]})
    
    # If chart suggested, generate it
    chart_data = None
    if result.get("chart_type"):
        try:
            from charts_core import (line_chart, bar_chart, histogram, pie_chart, 
                                     box_plot, heatmap_corr)
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            cat_cols = df.select_dtypes(include=['object']).columns.tolist()
            date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
            
            ct = result["chart_type"].lower().strip()
            primary_num = num_cols[0] if num_cols else None
            primary_cat = cat_cols[0] if cat_cols else None
            primary_date = date_cols[0] if date_cols else None
            
            # Try to find value columns
            value_patterns = ['revenue', 'sales', 'profit', 'amount', 'price']
            for col in num_cols:
                if any(p in col.lower() for p in value_patterns):
                    primary_num = col; break
            
            chart_result = None
            if 'line' in ct and primary_date and primary_num:
                chart_result = line_chart(df, primary_date, primary_num)
            elif 'bar' in ct and primary_cat and primary_num:
                chart_result = bar_chart(df, primary_cat, primary_num)
            elif 'pie' in ct and primary_cat:
                chart_result = pie_chart(df, primary_cat, primary_num)
            elif 'hist' in ct and primary_num:
                chart_result = histogram(df, primary_num)
            elif 'box' in ct and num_cols:
                chart_result = box_plot(df, num_cols[:6])
            elif 'heat' in ct and len(num_cols) >= 2:
                chart_result = heatmap_corr(df, num_cols)
            
            if chart_result:
                chart_data = chart_result
        except Exception:
            pass
    
    response = {
        "success": True,
        "answer": result["answer"],
        "chart_type": result.get("chart_type")
    }
    if chart_data:
        response["chart"] = chart_data
    
    return jsonify(response)


@app.route('/api/forecast', methods=['GET'])
def forecast():
    """Generate forecast."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    try:
        result = generate_forecast(df)
        if "error" in result:
            return jsonify(result), 400
        
        # Get AI commentary
        commentary = generate_forecast_commentary(result.get("summary", ""))
        result["commentary"] = commentary
        
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"error": f"Forecast failed: {str(e)}"}), 500


@app.route('/api/insights', methods=['GET'])
def insights():
    """Generate key insights."""
    if store.get("eda_results") is None:
        return jsonify({"error": "Run EDA first"}), 400
    
    try:
        eda_summary = store.get("dataset_summary", "")
        chart_descs = []
        if store.get("charts_cache"):
            chart_descs = [c.get("description", c.get("title", "")) for c in store["charts_cache"]]
        
        insights_list = generate_key_insights(eda_summary, chart_descs)
        
        return jsonify({
            "success": True,
            "insights": insights_list
        })
    except Exception as e:
        return jsonify({"error": f"Insight generation failed: {str(e)}"}), 500


@app.route('/api/whatif', methods=['POST'])
def whatif():
    """What-if scenario analysis."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No parameters provided"}), 400
    
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    target_col = data.get("target_col", "")
    adjust_col = data.get("adjust_col", "")
    adjust_pct = float(data.get("adjust_pct", 0))
    
    try:
        result = generate_whatif_chart(df, target_col, adjust_col, adjust_pct)
        if "error" in result:
            return jsonify(result), 400
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"error": f"What-if failed: {str(e)}"}), 500


@app.route('/api/dataset-info', methods=['GET'])
def dataset_info():
    """Get current dataset info."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400
    
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    return jsonify({
        "success": True,
        "name": store.get("dataset_name", "Unknown"),
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "numeric_columns": num_cols,
        "sample": _df_to_json_safe(df, 5)
    })


@app.route('/api/kpis', methods=['GET'])
def get_kpis():
    """Calculate auto-detected KPI metrics from the dataset."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400

    eda = store.get("eda_results") or {}
    kpis = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]

    # Helper to find columns by keyword
    def _find(keywords):
        for kw in keywords:
            for c in df.columns:
                if kw in c.lower():
                    return c
        return None

    # 1. Total Revenue/Sales
    val_col = _find(['revenue', 'sales', 'amount', 'total', 'profit'])
    if val_col and val_col in num_cols:
        total = float(df[val_col].sum())
        avg = float(df[val_col].mean())
        # Calculate trend from first half vs second half
        mid = len(df) // 2
        first_half = df[val_col].iloc[:mid].sum()
        second_half = df[val_col].iloc[mid:].sum()
        growth = ((second_half - first_half) / first_half * 100) if first_half > 0 else 0
        kpis.append({
            "label": f"Total {val_col}",
            "value": total,
            "format": "currency",
            "trend": round(growth, 1),
            "trend_label": f"{'+'if growth>0 else ''}{growth:.1f}% vs prior half"
        })
        kpis.append({
            "label": f"Avg {val_col}",
            "value": avg,
            "format": "currency",
            "trend": 0,
            "trend_label": f"per record"
        })

    # 2. Record Count
    kpis.append({
        "label": "Total Records",
        "value": len(df),
        "format": "number",
        "trend": 0,
        "trend_label": f"{len(df.columns)} columns"
    })

    # 3. Unique Customers
    cust_col = _find(['customer_id', 'customerid', 'customer', 'cust_id'])
    if cust_col:
        n_cust = int(df[cust_col].nunique())
        kpis.append({
            "label": "Unique Customers",
            "value": n_cust,
            "format": "number",
            "trend": 0,
            "trend_label": "distinct customers"
        })

    # 4. Time Range
    if date_cols:
        dc = date_cols[0]
        days = (df[dc].max() - df[dc].min()).days
        kpis.append({
            "label": "Time Span",
            "value": days,
            "format": "days",
            "trend": 0,
            "trend_label": f"{df[dc].min().strftime('%b %Y')} - {df[dc].max().strftime('%b %Y')}"
        })

    # 5. Data Quality Score
    df_original = store.get("df")
    total_rows = len(df_original) if df_original is not None else max(len(df), 1)
    total_cells = total_rows * len(df.columns)

    missing_after = eda.get("missing_values", {}).get("total_after", 0)
    dup_count = eda.get("duplicates", {}).get("removed", 0)
    outlier_count = eda.get("total_unique_outlier_rows", 0)
    
    completeness = max(0, (1 - missing_after / max(total_cells, 1)) * 100)
    uniqueness = max(0, (1 - dup_count / max(total_rows, 1)) * 100)
    outlier_score = max(0, 100 - (outlier_count / max(total_rows, 1) * 100))
    quality_score = round((completeness * 0.4 + uniqueness * 0.3 + outlier_score * 0.3), 1)
    
    if completeness == 100 and uniqueness == 100 and outlier_score == 100:
        quality_score = 100.0

    kpis.append({
        "label": "Data Quality",
        "value": quality_score,
        "format": "percent",
        "trend": 0,
        "trend_label": "composite score",
        "quality_breakdown": {
            "completeness": round(completeness, 1),
            "uniqueness": round(uniqueness, 1),
            "outlier_health": round(outlier_score, 1)
        }
    })

    return jsonify({"success": True, "kpis": kpis})


@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """Generate AI business recommendations based on the analysis."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"error": "No dataset loaded"}), 400

    eda = store.get("eda_results") or {}
    summary = store.get("dataset_summary") or ""

    # Try AI-generated recommendations
    try:
        from ai_analyst import generate_recommendations
        recs = generate_recommendations(summary, eda)
        if recs:
            return jsonify({"success": True, "recommendations": recs})
    except Exception:
        pass

    # Fallback: generate data-driven recommendations from EDA
    recs = _build_fallback_recommendations(df, eda)
    return jsonify({"success": True, "recommendations": recs})


def _build_fallback_recommendations(df, eda):
    """Build actionable recommendations from EDA results without AI."""
    recs = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # 1. Missing values
    missing = eda.get("missing_values", {}).get("total_before", 0)
    if missing > 0:
        pct = round(missing / (len(df) * len(df.columns)) * 100, 1)
        severity = "critical" if pct > 10 else "opportunity"
        recs.append({
            "severity": severity,
            "title": f"Data Completeness: {missing} missing values detected ({pct}%)",
            "description": f"Missing data was auto-filled using median/mode strategies. Consider improving data collection at source to reduce future gaps."
        })

    # 2. Outliers
    outliers = eda.get("outliers", {})
    total_outliers = sum(o.get("count", 0) for o in outliers.values())
    if total_outliers > 0:
        recs.append({
            "severity": "opportunity",
            "title": f"{total_outliers} outliers flagged across {len(outliers)} columns",
            "description": "Review outlier records for data entry errors or genuinely extreme events. Consider separate analysis for outlier segments."
        })

    # 3. Correlation insights
    if eda.get("correlation"):
        corr = eda["correlation"]
        strong_pairs = []
        for c1 in corr:
            for c2, val in corr[c1].items():
                if c1 != c2 and abs(val) > 0.7:
                    strong_pairs.append((c1, c2, val))
        if strong_pairs:
            pair = strong_pairs[0]
            recs.append({
                "severity": "strength",
                "title": f"Strong correlation: {pair[0]} and {pair[1]} (r={pair[2]:.2f})",
                "description": f"These variables are highly correlated. Consider using this relationship for prediction or investigate the causal mechanism."
            })

    # 4. Categorical distribution
    cat_info = eda.get("categorical_info", {})
    for col, info in list(cat_info.items())[:2]:
        top_vals = info.get("top_values", {})
        if top_vals:
            top_key = list(top_vals.keys())[0]
            top_count = list(top_vals.values())[0]
            pct = round(top_count / len(df) * 100, 1)
            if pct > 40:
                recs.append({
                    "severity": "opportunity",
                    "title": f"'{top_key}' dominates {col} at {pct}% of records",
                    "description": f"Consider diversification strategies or targeted campaigns for underrepresented segments."
                })

    # 5. Summary stats insights
    for col in num_cols[:3]:
        stats = eda.get("summary_stats", {}).get(col, {})
        mean = stats.get("mean", 0)
        std = stats.get("std", 0)
        if mean > 0 and std / mean > 0.8:
            recs.append({
                "severity": "opportunity",
                "title": f"High variance in {col} (CV={std/mean:.1%})",
                "description": f"Large variability suggests inconsistent performance. Investigate the drivers of high and low {col} values."
            })

    if not recs:
        recs.append({
            "severity": "strength",
            "title": "Dataset appears clean and well-structured",
            "description": "No major quality issues detected. Focus on deeper segment analysis and trend monitoring."
        })

    return recs[:6]


@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    """Export cleaned dataset as CSV."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"success": False, "error": "No dataset loaded"}), 400

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    safe_name = store.get("dataset_name", "export").replace(" ", "_")
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="datamind_{safe_name}.csv"',
            'Content-Type': 'text/csv; charset=utf-8'
        }
    )


@app.route('/api/export/excel', methods=['GET'])
def export_excel():
    """Export cleaned dataset as Excel with multiple sheets."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"success": False, "error": "No dataset loaded"}), 400

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: Full data
        df.to_excel(writer, sheet_name='Data', index=False)

        # Sheet 2: Summary statistics
        try:
            summary = df.describe(include='all').round(2)
            summary.to_excel(writer, sheet_name='Summary Statistics')
        except Exception:
            pass

        # Sheet 3: Data types & missing values
        try:
            info_df = pd.DataFrame({
                'Column': df.columns,
                'Data Type': [str(dt) for dt in df.dtypes],
                'Non-Null Count': df.count().values,
                'Null Count': df.isnull().sum().values,
                'Unique Values': df.nunique().values
            })
            info_df.to_excel(writer, sheet_name='Column Info', index=False)
        except Exception:
            pass

    output.seek(0)

    safe_name = store.get("dataset_name", "export").replace(" ", "_")
    from flask import send_file
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'datamind_{safe_name}.xlsx'
    )


@app.route('/api/export', methods=['GET'])
def export_report():
    """Export a structured analysis report as JSON."""
    df = store["df_clean"] if store.get("df_clean") is not None else store.get("df")
    if df is None:
        return jsonify({"success": False, "error": "No dataset loaded"}), 400

    eda = store.get("eda_results") or {}
    report = {
        "dataset_name": store.get("dataset_name", "Unknown"),
        "exported_at": pd.Timestamp.now().isoformat(),
        "shape": {
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns)
        },
        "eda_summary": {
            "duplicates_removed": eda.get("duplicates", {}).get("removed", 0),
            "missing_values_before": eda.get("missing_values", {}).get("total_before", 0),
            "missing_values_after": eda.get("missing_values", {}).get("total_after", 0),
            "fill_strategies": eda.get("missing_values", {}).get("strategies", {}),
            "outliers": eda.get("outliers", {}),
            "type_fixes": eda.get("type_fixes", []),
            "normalised_columns": eda.get("capitalisation", {}).get("normalised_columns", [])
        },
        "summary_stats": eda.get("summary_stats", {}),
        "charts_generated": [c.get("title") for c in (store.get("charts_cache") or [])],
        "insights": []
    }

    # Try to get latest insights
    try:
        from ai_analyst import generate_key_insights
        insights = generate_key_insights(store.get("dataset_summary", ""), [])
        report["insights"] = insights
    except Exception:
        pass

    return jsonify({"success": True, "report": report})


if __name__ == '__main__':
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("\n[!] WARNING: GROQ_API_KEY not set. AI features will use fallback text.")
        print("    Set it with: set GROQ_API_KEY=your_key_here\n")
    else:
        print("[OK] Groq API key detected")
    
    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Starting DataMind AI on http://localhost:{port}")
    app.run(debug=False, host='0.0.0.0', port=port)
