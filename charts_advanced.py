"""DataMind AI — Advanced Charts (Plotly)"""
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import json
from typing import Dict, Any

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
except ImportError:
    KMeans = None; StandardScaler = None

try:
    from mlxtend.frequent_patterns import apriori, association_rules
    from mlxtend.preprocessing import TransactionEncoder
except ImportError:
    apriori = None

COLORS = ['#00e5ff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
          '#ff922b','#cc5de8','#20c997','#ff6b81','#a8e6cf']
BG = '#0d0f14'; CARD = '#161a24'; TEXT = '#e2e8f0'; GRID = '#2d3748'

LAYOUT_BASE = dict(
    paper_bgcolor=BG, plot_bgcolor=CARD,
    font=dict(color=TEXT, family='DM Sans, sans-serif', size=12),
    title_font=dict(color=TEXT, size=15, family='Syne, sans-serif'),
    legend=dict(bgcolor=CARD, bordercolor=GRID, borderwidth=1),
    xaxis=dict(gridcolor=GRID, zerolinecolor=GRID, tickfont=dict(color=TEXT)),
    yaxis=dict(gridcolor=GRID, zerolinecolor=GRID, tickfont=dict(color=TEXT)),
    margin=dict(l=50, r=30, t=60, b=60),
    hoverlabel=dict(bgcolor=CARD, bordercolor=GRID,
                    font=dict(color=TEXT, size=12))
)

def _chart(fig, title, description, chart_type):
    fig.update_layout(title=dict(text=title, x=0.02), **LAYOUT_BASE)
    return {
        "title": title,
        "chart_type": chart_type,
        "description": description,
        "plotly_json": json.loads(fig.to_json())
    }


def waterfall_chart(df, date_col, num_col):
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, num_col])
    monthly = tmp.set_index(date_col).resample('ME')[num_col].sum().reset_index()
    if len(monthly) < 3:
        return None
    monthly = monthly.tail(12)
    changes = monthly[num_col].diff().fillna(monthly[num_col].iloc[0])
    labels = monthly[date_col].dt.strftime('%b %Y')

    fig = go.Figure(go.Waterfall(
        x=labels, y=changes,
        measure=['absolute'] + ['relative'] * (len(changes) - 1),
        increasing=dict(marker=dict(color='#6bcb77')),
        decreasing=dict(marker=dict(color='#ff6b6b')),
        totals=dict(marker=dict(color='#00e5ff')),
        hovertemplate='<b>%{x}</b><br>Change: %{y:,.0f}<extra></extra>',
        connector=dict(line=dict(color=GRID, width=1))
    ))
    return _chart(fig, f'{num_col} Waterfall (Monthly Changes)',
                  'Green = growth, Red = decline, monthly incremental changes.',
                  'waterfall_chart')


def double_axis_chart(df, date_col, num1, num2):
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, num1, num2])
    monthly = tmp.set_index(date_col).resample('ME')[[num1, num2]].sum().reset_index()
    if len(monthly) < 3:
        return None

    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Scatter(
        x=monthly[date_col], y=monthly[num1],
        name=num1, mode='lines+markers',
        line=dict(color='#00e5ff', width=3),
        marker=dict(size=5),
        hovertemplate=f'{num1}: %{{y:,.0f}}<extra></extra>'
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=monthly[date_col], y=monthly[num2],
        name=num2, mode='lines+markers',
        line=dict(color='#ff6b6b', width=3, dash='dash'),
        marker=dict(size=5),
        hovertemplate=f'{num2}: %{{y:,.0f}}<extra></extra>'
    ), secondary_y=True)
    fig.update_yaxes(title_text=num1, color='#00e5ff', secondary_y=False,
                     gridcolor=GRID, tickfont=dict(color=TEXT))
    fig.update_yaxes(title_text=num2, color='#ff6b6b', secondary_y=True,
                     gridcolor=GRID, tickfont=dict(color=TEXT))
    return _chart(fig, f'{num1} vs {num2} — Dual Axis',
                  f'Dual-axis comparison of {num1} and {num2} over time.',
                  'double_axis_chart')


def pareto_chart(df, cat_col, num_col=None):
    tmp = df.copy()
    if pd.api.types.is_datetime64_any_dtype(tmp[cat_col]): tmp[cat_col] = tmp[cat_col].dt.strftime('%Y-%m')
    data = tmp.groupby(cat_col)[num_col].sum().sort_values(ascending=False).head(10) \
           if num_col else tmp[cat_col].value_counts().head(10)
    if len(data) < 3:
        return None
    cum_pct = data.cumsum() / data.sum() * 100

    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(
        x=data.index, y=data.values,
        marker=dict(color=COLORS[:len(data)], line=dict(width=0)),
        hovertemplate='<b>%{x}</b><br>Value: %{y:,.0f}<extra></extra>',
        name='Value'
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=data.index, y=cum_pct.values,
        mode='lines+markers', name='Cumulative %',
        line=dict(color='#ff6b6b', width=2.5),
        marker=dict(size=6, color='#ff6b6b'),
        hovertemplate='Cumulative: %{y:.1f}%<extra></extra>'
    ), secondary_y=True)
    fig.add_hline(y=80, line=dict(color='#ffd93d', dash='dash', width=1.5),
                  secondary_y=True,
                  annotation=dict(text='80%', font=dict(color='#ffd93d')))
    fig.update_yaxes(title_text='Value', secondary_y=False,
                     gridcolor=GRID, tickfont=dict(color=TEXT))
    fig.update_yaxes(title_text='Cumulative %', secondary_y=True,
                     range=[0, 110], tickfont=dict(color=TEXT))
    fig.update_layout(xaxis_tickangle=-35)
    return _chart(fig, f'Pareto Analysis — {cat_col}',
                  f'80/20 rule: which {cat_col} categories drive most value.',
                  'pareto_chart')


def radar_chart(df, cat_col, num_cols):
    tmp = df.copy()
    if pd.api.types.is_datetime64_any_dtype(tmp[cat_col]): tmp[cat_col] = tmp[cat_col].dt.strftime('%Y-%m')
    metrics = num_cols[:6]
    if len(metrics) < 3:
        return None
    cats = tmp[cat_col].value_counts().head(4).index.tolist()
    if len(cats) < 2:
        return None

    fig = go.Figure()
    for i, cat in enumerate(cats):
        vals = tmp[tmp[cat_col] == cat][metrics].mean().values
        max_vals = np.where(tmp[metrics].max().values == 0, 1,
                            tmp[metrics].max().values)
        vals_norm = (vals / max_vals).tolist()
        vals_norm += vals_norm[:1]
        angles = metrics + [metrics[0]]
        fig.add_trace(go.Scatterpolar(
            r=vals_norm, theta=angles,
            name=str(cat), fill='toself',
            line=dict(color=COLORS[i % len(COLORS)], width=2),
            opacity=0.8,
            hovertemplate=f'<b>{cat}</b><br>%{{theta}}: %{{r:.2f}}<extra></extra>'
        ))
    fig.update_layout(
        polar=dict(
            bgcolor=CARD,
            radialaxis=dict(visible=True, gridcolor=GRID, tickfont=dict(color=TEXT)),
            angularaxis=dict(gridcolor=GRID, tickfont=dict(color=TEXT))
        )
    )
    return _chart(fig, f'Radar Chart — {cat_col} Comparison',
                  f'Multi-metric normalised comparison across {len(cats)} {cat_col} categories.',
                  'radar_chart')


def treemap_chart(df, cat_col, num_col):
    tmp = df.copy()
    if pd.api.types.is_datetime64_any_dtype(tmp[cat_col]): tmp[cat_col] = tmp[cat_col].dt.strftime('%Y-%m')
    data = tmp.groupby(cat_col)[num_col].sum().nlargest(15).reset_index()
    if len(data) < 2:
        return None

    fig = go.Figure(go.Treemap(
        labels=data[cat_col],
        parents=[''] * len(data),
        values=data[num_col],
        marker=dict(colors=COLORS[:len(data)],
                    line=dict(color=BG, width=2)),
        hovertemplate='<b>%{label}</b><br>Value: %{value:,.0f}<br>Share: %{percentRoot:.1%}<extra></extra>',
        textfont=dict(size=12, color='white'),
        texttemplate='<b>%{label}</b><br>%{value:,.0f}'
    ))
    return _chart(fig, f'Treemap — {num_col} by {cat_col}',
                  f'Proportional area treemap for {num_col} across {cat_col}.',
                  'treemap_chart')


def sunburst_chart(df, parent_col, child_col, num_col):
    tmp = df.copy()
    if pd.api.types.is_datetime64_any_dtype(tmp[parent_col]): tmp[parent_col] = tmp[parent_col].dt.strftime('%Y-%m')
    if pd.api.types.is_datetime64_any_dtype(tmp[child_col]): tmp[child_col] = tmp[child_col].dt.strftime('%Y-%m')
    grouped = tmp.groupby([parent_col, child_col])[num_col].sum().reset_index()
    if len(grouped) < 3:
        return None
    parent_totals = grouped.groupby(parent_col)[num_col].sum().reset_index()

    labels = ['Total'] + \
             list(parent_totals[parent_col]) + \
             list(grouped[child_col])
    parents = [''] + \
              ['Total'] * len(parent_totals) + \
              list(grouped[parent_col])
    values = [grouped[num_col].sum()] + \
             list(parent_totals[num_col]) + \
             list(grouped[num_col])

    fig = go.Figure(go.Sunburst(
        labels=labels, parents=parents, values=values,
        branchvalues='total',
        marker=dict(colors=COLORS * 10,
                    line=dict(color=BG, width=1)),
        hovertemplate='<b>%{label}</b><br>Value: %{value:,.0f}<br>Share: %{percentParent:.1%}<extra></extra>',
        textfont=dict(size=11, color='white')
    ))
    fig.update_layout(margin=dict(t=60, l=0, r=0, b=0))
    return _chart(fig, f'Sunburst — {parent_col} → {child_col}',
                  f'Hierarchical breakdown: {parent_col} → {child_col}.',
                  'sunburst_chart')


def rfm_chart(df, cust_col, date_col, value_col):
    if KMeans is None:
        return None
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[cust_col, date_col, value_col])
    if len(tmp) < 20:
        return None

    now = tmp[date_col].max() + pd.Timedelta(days=1)
    rfm = tmp.groupby(cust_col).agg({
        date_col: lambda x: (now - x.max()).days,
        value_col: ['count', 'sum']
    }).reset_index()
    rfm.columns = ['Customer', 'Recency', 'Frequency', 'Monetary']
    rfm = rfm[(rfm['Frequency'] > 0) & (rfm['Monetary'] > 0)]
    if len(rfm) < 10:
        return None

    scaler = StandardScaler()
    scaled = scaler.fit_transform(rfm[['Recency', 'Frequency', 'Monetary']])
    n_clusters = min(4, len(rfm))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    rfm['Cluster'] = km.fit_predict(scaled)

    segment_names = {0: 'Champions', 1: 'Loyal', 2: 'At Risk', 3: 'Lost'}
    rfm['Segment'] = rfm['Cluster'].map(segment_names)

    fig = px.scatter(
        rfm, x='Recency', y='Monetary', size='Frequency',
        color='Segment', color_discrete_sequence=COLORS,
        hover_data={'Customer': True, 'Recency': True,
                    'Frequency': True, 'Monetary': ':.0f'},
        size_max=30
    )
    fig.update_traces(
        hovertemplate='<b>%{customdata[0]}</b><br>'
                      'Recency: %{x} days<br>'
                      'Monetary: %{y:,.0f}<br>'
                      'Frequency: %{marker.size}<extra></extra>'
    )
    return _chart(fig, 'RFM Customer Segmentation (K-Means)',
                  f'{n_clusters} customer segments: Champions, Loyal, At Risk, Lost.',
                  'rfm_chart')


def market_basket_chart(df, cust_col, product_col):
    if apriori is None:
        return None
    baskets = df.groupby(cust_col)[product_col].apply(list).values.tolist()
    baskets = [list(set(b)) for b in baskets if len(b) >= 2]
    if len(baskets) < 10:
        return None
    try:
        te = TransactionEncoder()
        te_ary = te.fit(baskets).transform(baskets)
        basket_df = pd.DataFrame(te_ary, columns=te.columns_)
        freq = apriori(basket_df, min_support=0.02, use_colnames=True)
        if len(freq) < 2:
            return None
        rules = association_rules(freq, metric='lift',
                                  min_threshold=1.0, num_itemsets=len(freq))
        if len(rules) < 1:
            return None
        rules = rules.head(30)
        rules['antecedents_str'] = rules['antecedents'].apply(lambda x: ', '.join(list(x)))
        rules['consequents_str'] = rules['consequents'].apply(lambda x: ', '.join(list(x)))
        rules['rule'] = rules['antecedents_str'] + ' → ' + rules['consequents_str']

        fig = px.scatter(
            rules, x='support', y='confidence', size='lift',
            color='lift', color_continuous_scale='Plasma',
            hover_data={'rule': True, 'support': ':.3f',
                        'confidence': ':.3f', 'lift': ':.2f'},
            size_max=30
        )
        fig.update_traces(
            hovertemplate='<b>%{customdata[0]}</b><br>'
                          'Support: %{x:.3f}<br>'
                          'Confidence: %{y:.3f}<br>'
                          'Lift: %{marker.color:.2f}<extra></extra>'
        )
        fig.update_layout(coloraxis_colorbar=dict(tickfont=dict(color=TEXT)))
        return _chart(fig, 'Market Basket Analysis (Apriori)',
                      f'{len(rules)} association rules found. Hover to see product pairs.',
                      'market_basket_chart')
    except Exception:
        return None


def cohort_retention(df, cust_col, date_col):
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[cust_col, date_col])
    tmp['OrderPeriod'] = tmp[date_col].dt.to_period('M')
    tmp['CohortPeriod'] = tmp.groupby(cust_col)[date_col].transform('min').dt.to_period('M')
    tmp['PeriodNumber'] = (tmp['OrderPeriod'] - tmp['CohortPeriod']).apply(
        lambda x: x.n if hasattr(x, 'n') else 0)
    cohort_data = tmp.groupby(['CohortPeriod', 'PeriodNumber'])[cust_col].nunique().reset_index()
    cohort_data.columns = ['CohortPeriod', 'PeriodNumber', 'Customers']
    cohort_pivot = cohort_data.pivot(index='CohortPeriod', columns='PeriodNumber',
                                     values='Customers')
    if cohort_pivot.shape[0] < 3 or cohort_pivot.shape[1] < 2:
        return None
    cohort_size = cohort_pivot.iloc[:, 0]
    retention = (cohort_pivot.divide(cohort_size, axis=0) * 100).round(1)
    retention = retention.iloc[:12, :12]

    fig = go.Figure(go.Heatmap(
        z=retention.values,
        x=[f'Month {i}' for i in retention.columns],
        y=[str(c) for c in retention.index],
        colorscale='YlGnBu', zmin=0, zmax=100,
        text=retention.values,
        texttemplate='%{text:.0f}%',
        hovertemplate='Cohort: %{y}<br>%{x}<br>Retention: %{z:.1f}%<extra></extra>',
        colorbar=dict(title='Retention %', tickfont=dict(color=TEXT))
    ))
    return _chart(fig, 'Customer Retention Cohort Map',
                  'Monthly cohort retention rates — hover for exact percentages.',
                  'cohort_retention')


def bcg_matrix(df, product_col, value_col, date_col=None):
    if not date_col:
        return None
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, value_col])
    tmp['Year'] = tmp[date_col].dt.year
    years = sorted(tmp['Year'].unique())
    if len(years) < 2:
        return None

    recent = tmp[tmp['Year'] == years[-1]].groupby(product_col)[value_col].sum()
    prev = tmp[tmp['Year'] == years[-2]].groupby(product_col)[value_col].sum()
    products = list(set(recent.index) & set(prev.index))
    if len(products) < 3:
        return None

    growth = {p: ((recent.get(p,0) - prev.get(p,0)) / max(prev.get(p,1),1)) * 100
              for p in products}
    share = {p: float(recent.get(p, 0)) for p in products}

    plot_df = pd.DataFrame({
        'Product': products,
        'Share': [share[p] for p in products],
        'Growth': [growth[p] for p in products]
    })

    med_share = plot_df['Share'].median()
    med_growth = plot_df['Growth'].median()

    def quadrant(row):
        if row['Share'] >= med_share and row['Growth'] >= med_growth:
            return '⭐ Stars'
        elif row['Share'] < med_share and row['Growth'] >= med_growth:
            return '❓ Question Marks'
        elif row['Share'] >= med_share and row['Growth'] < med_growth:
            return '🐄 Cash Cows'
        else:
            return '🐕 Dogs'

    plot_df['Quadrant'] = plot_df.apply(quadrant, axis=1)

    fig = px.scatter(
        plot_df, x='Share', y='Growth', text='Product',
        color='Quadrant', color_discrete_sequence=COLORS,
        hover_data={'Product': True, 'Share': ':,.0f', 'Growth': ':.1f'}
    )
    fig.update_traces(
        marker=dict(size=16, line=dict(color='white', width=1)),
        textposition='top center',
        textfont=dict(color=TEXT, size=9),
        hovertemplate='<b>%{text}</b><br>Share: %{x:,.0f}<br>Growth: %{y:.1f}%<extra></extra>'
    )
    fig.add_vline(x=med_share, line=dict(color=GRID, dash='dash', width=1))
    fig.add_hline(y=med_growth, line=dict(color=GRID, dash='dash', width=1))
    return _chart(fig, 'BCG Growth-Share Matrix',
                  f'{len(products)} products classified into Stars, Cash Cows, Question Marks, Dogs.',
                  'bcg_matrix')
