"""DataMind AI — Core Charts (Plotly)"""
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import json
from typing import Dict, Any, Optional

COLORS = ['#00e5ff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
          '#ff922b','#cc5de8','#20c997','#ff6b81','#a8e6cf']
BG = '#0d0f14'
CARD = '#161a24'
TEXT = '#e2e8f0'
GRID = '#2d3748'

LAYOUT_BASE = dict(
    paper_bgcolor=BG,
    plot_bgcolor=CARD,
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
    """Finalise a chart and return standard dict."""
    fig.update_layout(title=dict(text=title, x=0.02), **LAYOUT_BASE)
    return {
        "title": title,
        "chart_type": chart_type,
        "description": description,
        "plotly_json": json.loads(fig.to_json())
    }


def line_chart(df, date_col, num_col):
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, num_col])
    monthly = tmp.set_index(date_col).resample('ME')[num_col].sum().reset_index()
    if len(monthly) < 2:
        return None

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=monthly[date_col], y=monthly[num_col],
        mode='lines+markers',
        line=dict(color='#00e5ff', width=3),
        marker=dict(size=6, color='white', line=dict(color='#00e5ff', width=2)),
        fill='tozeroy', fillcolor='rgba(0,229,255,0.08)',
        hovertemplate=f'<b>%{{x|%b %Y}}</b><br>{num_col}: %{{y:,.0f}}<extra></extra>',
        name=num_col
    ))
    return _chart(fig, f'Monthly {num_col} Trend',
                  f'Monthly aggregated {num_col} over {len(monthly)} periods.',
                  'line_chart')


def bar_chart(df, cat_col, num_col, top_n=10):
    grouped = df.groupby(cat_col)[num_col].sum().nlargest(top_n).reset_index()
    if len(grouped) < 2:
        return None

    fig = go.Figure(go.Bar(
        x=grouped[cat_col], y=grouped[num_col],
        marker=dict(color=COLORS[:len(grouped)], line=dict(width=0)),
        hovertemplate=f'<b>%{{x}}</b><br>{num_col}: %{{y:,.0f}}<extra></extra>',
        text=grouped[num_col].apply(lambda v:
            f'{v/1e6:.1f}M' if v >= 1e6 else f'{v/1e3:.1f}K' if v >= 1e3 else f'{v:.0f}'),
        textposition='outside', textfont=dict(color=TEXT, size=10)
    ))
    fig.update_layout(xaxis_tickangle=-35)
    return _chart(fig, f'{num_col} by {cat_col}',
                  f'Top {len(grouped)} {cat_col} categories by {num_col}.',
                  'bar_chart')


def grouped_bar(df, cat1, cat2, num_col):
    pivot = df.pivot_table(index=cat1, columns=cat2,
                           values=num_col, aggfunc='sum').fillna(0)
    if pivot.shape[0] > 10:
        pivot = pivot.loc[pivot.sum(axis=1).nlargest(10).index]
    if pivot.shape[1] > 6:
        pivot = pivot[pivot.sum().nlargest(6).index]
    if pivot.empty:
        return None

    fig = go.Figure()
    for i, col in enumerate(pivot.columns):
        fig.add_trace(go.Bar(
            name=str(col), x=pivot.index, y=pivot[col],
            marker_color=COLORS[i % len(COLORS)],
            hovertemplate=f'<b>%{{x}}</b><br>{col}: %{{y:,.0f}}<extra></extra>'
        ))
    fig.update_layout(barmode='group', xaxis_tickangle=-35)
    return _chart(fig, f'{num_col} by {cat1} & {cat2}',
                  f'Grouped comparison across {cat1} and {cat2}.',
                  'grouped_bar')


def stacked_bar(df, cat1, cat2, num_col):
    pivot = df.pivot_table(index=cat1, columns=cat2,
                           values=num_col, aggfunc='sum').fillna(0)
    if pivot.shape[0] > 10:
        pivot = pivot.loc[pivot.sum(axis=1).nlargest(10).index]
    if pivot.empty:
        return None

    fig = go.Figure()
    for i, col in enumerate(pivot.columns):
        fig.add_trace(go.Bar(
            name=str(col), x=pivot.index, y=pivot[col],
            marker_color=COLORS[i % len(COLORS)],
            hovertemplate=f'<b>%{{x}}</b><br>{col}: %{{y:,.0f}}<extra></extra>'
        ))
    fig.update_layout(barmode='stack', xaxis_tickangle=-35)
    return _chart(fig, f'Stacked {num_col} by {cat1}',
                  f'Stacked breakdown of {num_col} across {cat1} by {cat2}.',
                  'stacked_bar')


def pie_chart(df, cat_col, num_col=None):
    data = df.groupby(cat_col)[num_col].sum() if num_col \
           else df[cat_col].value_counts()
    if len(data) > 8 or len(data) < 2:
        return None

    fig = go.Figure(go.Pie(
        labels=data.index, values=data.values,
        marker=dict(colors=COLORS[:len(data)],
                    line=dict(color=BG, width=2)),
        hovertemplate='<b>%{label}</b><br>Value: %{value:,.0f}<br>Share: %{percent}<extra></extra>',
        textfont=dict(color='white', size=11),
        hole=0
    ))
    return _chart(fig, f'{cat_col} Distribution',
                  f'Proportional breakdown across {len(data)} {cat_col} categories.',
                  'pie_chart')


def doughnut_chart(df, cat_col, num_col=None):
    data = df.groupby(cat_col)[num_col].sum() if num_col \
           else df[cat_col].value_counts()
    if len(data) > 8 or len(data) < 2:
        return None

    fig = go.Figure(go.Pie(
        labels=data.index, values=data.values,
        marker=dict(colors=COLORS[:len(data)],
                    line=dict(color=BG, width=2)),
        hovertemplate='<b>%{label}</b><br>Value: %{value:,.0f}<br>Share: %{percent}<extra></extra>',
        textfont=dict(color='white', size=11),
        hole=0.55
    ))
    fig.add_annotation(
        text=f"Total<br><b>{data.sum():,.0f}</b>",
        x=0.5, y=0.5, font=dict(size=13, color=TEXT),
        showarrow=False
    )
    return _chart(fig, f'{cat_col} Breakdown',
                  f'Doughnut chart showing {cat_col} proportions.',
                  'doughnut_chart')


def histogram(df, num_col):
    data = df[num_col].dropna()
    if len(data) < 10:
        return None

    fig = go.Figure()
    fig.add_trace(go.Histogram(
        x=data, nbinsx=30,
        marker=dict(color='#00e5ff', line=dict(color=BG, width=0.5)),
        opacity=0.85, name=num_col,
        hovertemplate='Range: %{x}<br>Count: %{y}<extra></extra>'
    ))
    fig.add_vline(x=data.mean(), line=dict(color='#ff6b6b', dash='dash', width=2),
                  annotation=dict(text=f'Mean: {data.mean():.1f}',
                                  font=dict(color='#ff6b6b')))
    fig.add_vline(x=data.median(), line=dict(color='#ffd93d', dash='dash', width=2),
                  annotation=dict(text=f'Median: {data.median():.1f}',
                                  font=dict(color='#ffd93d'), y=0.85))
    return _chart(fig, f'{num_col} Distribution',
                  f'mean={data.mean():.1f}, median={data.median():.1f}, std={data.std():.1f}',
                  'histogram')


def box_plot(df, num_cols):
    cols = [c for c in num_cols if df[c].dropna().shape[0] > 5][:6]
    if not cols:
        return None

    fig = go.Figure()
    for i, col in enumerate(cols):
        fig.add_trace(go.Box(
            y=df[col].dropna(), name=col,
            marker=dict(color=COLORS[i % len(COLORS)], size=4),
            line=dict(color=COLORS[i % len(COLORS)]),
            boxmean=True,
            hovertemplate=f'<b>{col}</b><br>%{{y:,.2f}}<extra></extra>'
        ))
    return _chart(fig, 'Numeric Distributions — Box Plot',
                  f'Quartiles and outliers across {len(cols)} numeric columns.',
                  'box_plot')


def violin_plot(df, num_col, cat_col):
    cats = df[cat_col].value_counts().head(6).index.tolist()
    tmp = df[df[cat_col].isin(cats)].dropna(subset=[num_col, cat_col])
    if len(tmp) < 10:
        return None

    fig = go.Figure()
    for i, cat in enumerate(cats):
        fig.add_trace(go.Violin(
            y=tmp[tmp[cat_col] == cat][num_col],
            name=str(cat),
            box_visible=True, meanline_visible=True,
            fillcolor=COLORS[i % len(COLORS)],
            opacity=0.7, line_color=COLORS[i % len(COLORS)],
            hovertemplate=f'<b>{cat}</b><br>%{{y:,.2f}}<extra></extra>'
        ))
    fig.update_layout(violinmode='overlay')
    return _chart(fig, f'{num_col} by {cat_col} — Violin',
                  f'Distribution density of {num_col} across {cat_col} categories.',
                  'violin_plot')


def heatmap_corr(df, num_cols):
    if len(num_cols) < 2:
        return None
    corr = df[num_cols].corr().round(2)

    fig = go.Figure(go.Heatmap(
        z=corr.values, x=corr.columns, y=corr.index,
        colorscale='RdBu', zmid=0, zmin=-1, zmax=1,
        text=corr.values.round(2),
        texttemplate='%{text}',
        hovertemplate='%{x} × %{y}<br>r = %{z:.3f}<extra></extra>',
        colorbar=dict(tickfont=dict(color=TEXT))
    ))
    fig.update_layout(xaxis_tickangle=-35)
    return _chart(fig, 'Correlation Matrix',
                  f'Correlation heatmap for {len(num_cols)} numeric features.',
                  'heatmap_corr')


def seasonal_heatmap(df, date_col, num_col):
    tmp = df.copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col, num_col])
    tmp['Year'] = tmp[date_col].dt.year
    tmp['Month'] = tmp[date_col].dt.month
    pivot = tmp.pivot_table(index='Month', columns='Year',
                            values=num_col, aggfunc='sum')
    if pivot.shape[0] < 3:
        return None

    month_names = ['Jan','Feb','Mar','Apr','May','Jun',
                   'Jul','Aug','Sep','Oct','Nov','Dec']
    y_labels = [month_names[m-1] for m in pivot.index]

    fig = go.Figure(go.Heatmap(
        z=pivot.values, x=[str(c) for c in pivot.columns],
        y=y_labels, colorscale='YlOrRd',
        hovertemplate='Year: %{x}<br>Month: %{y}<br>Value: %{z:,.0f}<extra></extra>',
        text=pivot.values.round(0),
        texttemplate='%{text:,.0f}',
        colorbar=dict(tickfont=dict(color=TEXT))
    ))
    return _chart(fig, f'Seasonal {num_col} Heatmap',
                  f'Month vs Year heatmap revealing seasonal patterns in {num_col}.',
                  'seasonal_heatmap')
