"""DataMind AI — Chart Orchestrator & Forecasting"""
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import json
from typing import Dict, List, Any
from charts_core import (line_chart, bar_chart, grouped_bar, stacked_bar, pie_chart,
    doughnut_chart, histogram, box_plot, violin_plot, heatmap_corr, seasonal_heatmap)
from charts_advanced import (waterfall_chart, double_axis_chart, pareto_chart, radar_chart,
    treemap_chart, sunburst_chart, rfm_chart, market_basket_chart, cohort_retention, bcg_matrix)
from ai_analyst import get_chart_caption, build_dataset_summary

try:
    from statsmodels.tsa.seasonal import seasonal_decompose
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

BG = '#161a24'; CARD = '#161a24'; TEXT = '#e2e8f0'; GRID = '#2d3748'; ACCENT = '#00e5ff'

def _get_col_types(df):
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object']).columns.tolist()
    date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    return num_cols, cat_cols, date_cols

def _find_cols(df, patterns, dtype='any'):
    """Find columns matching name patterns."""
    cols = []
    for col in df.columns:
        cl = col.lower()
        for p in patterns:
            if p in cl:
                cols.append(col)
                break
    return cols

def _safe_chart(fn, *args, **kwargs):
    """Safely call a chart function, returning None on any error."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        print(f"[Chart Warning] {fn.__name__} failed: {e}")
        return None

def _is_id_column(df, col):
    """Check if a column is likely an ID/identifier (high cardinality, not useful for charts)."""
    cl = col.lower()
    id_patterns = ['_id', 'id_', 'order_id', 'orderid', 'transaction', 'invoice', 'row_id', 'rowid', 'index']
    if any(p in cl for p in id_patterns):
        return True
    # If unique count is > 50% of rows, it's likely an ID
    if df[col].nunique() > len(df) * 0.5:
        return True
    return False

def _best_cat_cols(df, cat_cols, max_unique=15):
    """Return categorical columns sorted by chart-friendliness (low-medium cardinality, no IDs)."""
    good = []
    for c in cat_cols:
        if _is_id_column(df, c):
            continue
        nunique = df[c].nunique()
        if 2 <= nunique <= max_unique:
            good.append((c, nunique))
    # Sort by cardinality: prefer 3-8 unique values first (most chart-friendly)
    good.sort(key=lambda x: abs(x[1] - 5))
    return [c for c, _ in good]

def generate_all_charts(df, eda_results=None) -> List[Dict[str, Any]]:
    """Intelligently generate all relevant charts based on dataset columns."""
    charts = []
    num_cols, cat_cols, date_cols = _get_col_types(df)

    # Filter out ID columns from categoricals
    good_cats = _best_cat_cols(df, cat_cols, max_unique=15)
    bar_cats = _best_cat_cols(df, cat_cols, max_unique=12)  # Stricter for bar charts

    # Build summary for AI captions
    summary = f"{len(df)} rows, {len(df.columns)} columns. Numeric: {', '.join(num_cols[:5])}. Categorical: {', '.join(good_cats[:5])}."

    # Revenue/sales/profit columns
    value_cols = _find_cols(df, ['revenue', 'sales', 'profit', 'amount', 'price', 'cost', 'total'])
    value_cols = [c for c in value_cols if c in num_cols]
    primary_value = value_cols[0] if value_cols else (num_cols[0] if num_cols else None)

    # Helper to find special columns (non-ID)
    cust_cols = [c for c in df.columns
                 if any(p in c.lower() for p in ['customer_id', 'customerid', 'cust_id', 'custid'])
                 and df[c].nunique() > len(df) * 0.05]
    prod_cols = _find_cols(df, ['product', 'item', 'product_name'])
    prod_cols = [c for c in prod_cols if c in cat_cols and df[c].nunique() <= 30]

    # 1. Line Chart (Monthly Trend)
    if date_cols and primary_value:
        r = _safe_chart(line_chart, df, date_cols[0], primary_value)
        if r: charts.append(r)

    # 2. Bar Chart — use best categorical column (NOT Order_ID)
    if bar_cats and primary_value:
        r = _safe_chart(bar_chart, df, bar_cats[0], primary_value)
        if r: charts.append(r)

    # 3. Grouped Bar Chart — need two good categorical columns
    if len(bar_cats) >= 2 and primary_value:
        r = _safe_chart(grouped_bar, df, bar_cats[0], bar_cats[1], primary_value)
        if r: charts.append(r)

    # 4. Stacked Bar Chart — need two good categorical columns
    if len(bar_cats) >= 2 and primary_value:
        c1, c2 = bar_cats[0], bar_cats[1]
        r = _safe_chart(stacked_bar, df, c1, c2, primary_value)
        if r: charts.append(r)

    # 5. Pie Chart — only with low cardinality (2-8)
    pie_cats = [c for c in good_cats if 2 <= df[c].nunique() <= 8]
    if pie_cats and primary_value:
        r = _safe_chart(pie_chart, df, pie_cats[0], primary_value)
        if r: charts.append(r)

    # 6. Doughnut Chart — different column from pie
    if len(pie_cats) > 1 and primary_value:
        r = _safe_chart(doughnut_chart, df, pie_cats[1], primary_value)
        if r: charts.append(r)
    elif pie_cats and primary_value and not charts:
        # Fallback if no pie was added
        r = _safe_chart(doughnut_chart, df, pie_cats[0], primary_value)
        if r: charts.append(r)

    # 7. Histogram
    if primary_value:
        r = _safe_chart(histogram, df, primary_value)
        if r: charts.append(r)

    # 8. Box Plot
    if len(num_cols) >= 1:
        r = _safe_chart(box_plot, df, num_cols[:6])
        if r: charts.append(r)

    # 9. Violin Plot — needs a good categorical grouping column
    if good_cats and num_cols:
        for cc in good_cats:
            if 2 <= df[cc].nunique() <= 8:
                r = _safe_chart(violin_plot, df, primary_value or num_cols[0], cc)
                if r: charts.append(r); break

    # 10. Correlation Heatmap
    if len(num_cols) >= 2:
        r = _safe_chart(heatmap_corr, df, num_cols)
        if r: charts.append(r)

    # 11. Seasonal Heatmap
    if date_cols and primary_value:
        r = _safe_chart(seasonal_heatmap, df, date_cols[0], primary_value)
        if r: charts.append(r)

    # 12. Waterfall Chart
    if date_cols and primary_value:
        r = _safe_chart(waterfall_chart, df, date_cols[0], primary_value)
        if r: charts.append(r)

    # 13. Double Axis
    if date_cols and len(value_cols) >= 2:
        r = _safe_chart(double_axis_chart, df, date_cols[0], value_cols[0], value_cols[1])
        if r: charts.append(r)

    # 14. Pareto Chart — use the best bar-chart-friendly column
    if bar_cats and primary_value:
        r = _safe_chart(pareto_chart, df, bar_cats[0], primary_value)
        if r: charts.append(r)

    # 15. Radar Chart
    if good_cats and len(num_cols) >= 3:
        r = _safe_chart(radar_chart, df, good_cats[0], num_cols[:6])
        if r: charts.append(r)

    # 16. Treemap — use a medium-cardinality column
    treemap_cats = [c for c in good_cats if 3 <= df[c].nunique() <= 15]
    if treemap_cats and primary_value:
        r = _safe_chart(treemap_chart, df, treemap_cats[0], primary_value)
        if r: charts.append(r)

    # 17. Sunburst
    parent_child = _find_cols(df, ['category'])
    sub_child = _find_cols(df, ['sub_category', 'sub category', 'subcategory'])
    if parent_child and sub_child and primary_value:
        r = _safe_chart(sunburst_chart, df, parent_child[0], sub_child[0], primary_value)
        if r: charts.append(r)

    # 18. RFM Analysis
    if cust_cols and date_cols and primary_value:
        r = _safe_chart(rfm_chart, df, cust_cols[0], date_cols[0], primary_value)
        if r: charts.append(r)

    # 19. Market Basket
    if cust_cols and prod_cols:
        r = _safe_chart(market_basket_chart, df, cust_cols[0], prod_cols[0])
        if r: charts.append(r)

    # 20. Cohort Retention
    if cust_cols and date_cols:
        r = _safe_chart(cohort_retention, df, cust_cols[0], date_cols[0])
        if r: charts.append(r)

    # 21. BCG Matrix
    if prod_cols and primary_value and date_cols:
        r = _safe_chart(bcg_matrix, df, prod_cols[0], primary_value, date_cols[0])
        if r: charts.append(r)

    # AI captions — test one call first; if rate-limited, skip all (saves ~15s)
    captions_enabled = False
    if charts:
        try:
            test_caption = get_chart_caption(charts[0]["title"], charts[0].get("description", ""), summary)
            if test_caption and "rate limit" not in test_caption.lower():
                charts[0]["caption"] = test_caption
                captions_enabled = True
        except Exception:
            pass

    if captions_enabled and len(charts) > 1:
        import concurrent.futures
        def fetch_caption(chart):
            try:
                caption = get_chart_caption(chart["title"], chart.get("description", ""), summary)
                chart["caption"] = caption
            except Exception:
                chart["caption"] = chart.get("description", "Explore this chart for key patterns.")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            executor.map(fetch_caption, charts[1:])
    else:
        for chart in charts:
            if "caption" not in chart:
                chart["caption"] = chart.get("description", "Explore this chart for key patterns.")

    return charts


def generate_forecast(df) -> Dict[str, Any]:
    """Generate time series forecast if date + numeric columns exist."""
    num_cols, cat_cols, date_cols = _get_col_types(df)
    if not date_cols or not num_cols:
        return {"error": "No date or numeric columns available for forecasting."}

    value_cols = _find_cols(df, ['revenue', 'sales', 'profit', 'amount', 'units'])
    value_cols = [c for c in value_cols if c in num_cols]
    target = value_cols[0] if value_cols else num_cols[0]
    date_col = date_cols[0]

    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, target])
    monthly = tmp.set_index(date_col).resample('ME')[target].sum()
    monthly = monthly[monthly > 0]

    if len(monthly) < 6:
        return {"error": "Insufficient data points for forecasting (need 6+ months)."}

    forecast_periods = 3
    forecast_result = {}

    if HAS_STATSMODELS:
        try:
            seasonal_periods = min(12, len(monthly) // 2)
            if seasonal_periods < 2:
                seasonal_periods = 2

            model = ExponentialSmoothing(monthly, trend='add',
                seasonal='add' if len(monthly) >= 2 * seasonal_periods else None,
                seasonal_periods=seasonal_periods if len(monthly) >= 2 * seasonal_periods else None)
            fitted = model.fit(optimized=True)
            forecast = fitted.forecast(forecast_periods)
            residuals = fitted.resid
            std_err = residuals.std()
            ci_upper = forecast + 1.96 * std_err
            ci_lower = forecast - 1.96 * std_err
        except Exception:
            # Fallback: simple linear trend
            x = np.arange(len(monthly))
            y = monthly.values
            coeffs = np.polyfit(x, y, 1)
            future_x = np.arange(len(monthly), len(monthly) + forecast_periods)
            forecast_vals = np.polyval(coeffs, future_x)
            last_date = monthly.index[-1]
            forecast_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=forecast_periods, freq='M')
            forecast = pd.Series(forecast_vals, index=forecast_dates)
            std_err = np.std(y - np.polyval(coeffs, x))
            ci_upper = forecast + 1.96 * std_err
            ci_lower = forecast - 1.96 * std_err
    else:
        x = np.arange(len(monthly))
        y = monthly.values
        coeffs = np.polyfit(x, y, 1)
        future_x = np.arange(len(monthly), len(monthly) + forecast_periods)
        forecast_vals = np.polyval(coeffs, future_x)
        last_date = monthly.index[-1]
        forecast_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=forecast_periods, freq='M')
        forecast = pd.Series(forecast_vals, index=forecast_dates)
        std_err = np.std(y - np.polyval(coeffs, x))
        ci_upper = forecast + 1.96 * std_err
        ci_lower = forecast - 1.96 * std_err

    # Plot with Plotly
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=monthly.index, y=monthly.values,
        mode='lines+markers', name='Actual',
        line=dict(color='#00e5ff', width=3),
        marker=dict(size=5),
        hovertemplate='<b>%{x|%b %Y}</b><br>Actual: %{y:,.0f}<extra></extra>'
    ))
    fig.add_trace(go.Scatter(
        x=forecast.index, y=forecast.values,
        mode='lines+markers', name='Forecast',
        line=dict(color='#ff6b6b', width=3, dash='dash'),
        marker=dict(size=6, symbol='square'),
        hovertemplate='<b>%{x|%b %Y}</b><br>Forecast: %{y:,.0f}<extra></extra>'
    ))
    fig.add_trace(go.Scatter(
        x=list(forecast.index) + list(forecast.index[::-1]),
        y=list(ci_upper.values) + list(ci_lower.values[::-1]),
        fill='toself', fillcolor='rgba(255,107,107,0.15)',
        line=dict(width=0), showlegend=True, name='95% CI',
        hoverinfo='skip'
    ))
    fig.update_layout(
        title=dict(text=f'{target} Forecast — Next {forecast_periods} Months', x=0.02),
        paper_bgcolor='#0d0f14', plot_bgcolor='#161a24',
        font=dict(color='#e2e8f0', family='DM Sans, sans-serif'),
        xaxis=dict(gridcolor='#2d3748', tickfont=dict(color='#e2e8f0')),
        yaxis=dict(gridcolor='#2d3748', tickfont=dict(color='#e2e8f0')),
        legend=dict(bgcolor='#161a24', bordercolor='#2d3748'),
        hoverlabel=dict(bgcolor='#161a24', font=dict(color='#e2e8f0')),
        margin=dict(l=50, r=30, t=60, b=60)
    )
    chart_json = json.loads(fig.to_json())

    actual_last = float(monthly.values[-1])
    forecast_last = float(forecast.values[-1])
    growth_pct = round(((forecast_last - actual_last) / max(actual_last, 1)) * 100, 1)

    forecast_summary = (f"Target: {target}. Last actual: {actual_last:,.0f}. "
                        f"Forecast end: {forecast_last:,.0f}. "
                        f"Projected change: {growth_pct:+.1f}%. "
                        f"Forecast period: {forecast_periods} months.")

    return {
        "chart_json": chart_json,
        "title": f"{target} Forecast",
        "summary": forecast_summary,
        "growth_pct": growth_pct,
        "target_col": target
    }


def generate_whatif_chart(df, target_col, adjust_col, adjust_pct) -> Dict[str, Any]:
    """Generate what-if scenario chart."""
    import pandas as pd
    # Direct column validation — don't rely on _get_col_types
    if target_col not in df.columns or adjust_col not in df.columns:
        return {"error": f"Column '{target_col}' or '{adjust_col}' not found in dataset."}

    if not pd.api.types.is_numeric_dtype(df[target_col]):
        return {"error": f"'{target_col}' is not a numeric column."}
    if not pd.api.types.is_numeric_dtype(df[adjust_col]):
        return {"error": f"'{adjust_col}' is not a numeric column."}

    try:
        original_val = float(df[target_col].sum())
        if pd.isna(original_val) or original_val == 0:
            original_val = float(df[target_col].dropna().sum())

        factor = 1 + (adjust_pct / 100.0)
        projected_val = original_val * factor

        # Generate scenario points centered around the selected percentage
        pcts = sorted(set([-30, -20, -10, 0, int(adjust_pct), 10, 20, 30]))
        vals = [original_val * (1 + p / 100.0) for p in pcts]

        fig = go.Figure()
        # Highlight the selected scenario bar
        colors_bar = []
        for p in pcts:
            if p == int(adjust_pct):
                colors_bar.append('#00e5ff')  # Accent - selected scenario
            elif p < 0:
                colors_bar.append('#ff6b6b')
            elif p > 0:
                colors_bar.append('#6bcb77')
            else:
                colors_bar.append('#4a5568')  # Neutral for 0%

        fig.add_trace(go.Bar(
            x=[f"{p:+d}%" for p in pcts], y=vals,
            marker=dict(color=colors_bar, line=dict(width=0)),
            hovertemplate='Change: %{x}<br>Projected: %{y:,.0f}<extra></extra>',
            text=[f'{v:,.0f}' for v in vals],
            textposition='outside', textfont=dict(color='#e2e8f0')
        ))
        fig.add_hline(y=original_val, line=dict(color='#ffd93d', dash='dash', width=2),
                      annotation=dict(text=f'Current: {original_val:,.0f}', font=dict(color='#ffd93d')))
        fig.update_layout(
            title=dict(text=f'What-If: {target_col} when {adjust_col} changes by {adjust_pct:+.0f}%', x=0.02),
            paper_bgcolor='#0d0f14', plot_bgcolor='#161a24',
            font=dict(color='#e2e8f0'), xaxis=dict(gridcolor='#2d3748'),
            yaxis=dict(gridcolor='#2d3748'), margin=dict(l=50, r=30, t=60, b=60)
        )

        return {
            "success": True,
            "chart_json": json.loads(fig.to_json()),
            "title": f"What-If: {target_col}",
            "original": round(original_val, 2),
            "projected": round(projected_val, 2),
            "change_pct": adjust_pct
        }
    except Exception as e:
        return {"error": f"What-if chart generation failed: {str(e)}"}

