"""
DataMind AI — Groq API Interaction Module
Handles all AI-powered analysis, captions, chat, and insight generation.
"""

import os
import json
from typing import List, Dict, Any, Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from groq import Groq
except ImportError:
    Groq = None


def _get_client_and_model() -> tuple:
    """Get the appropriate AI client and model name based on available API keys.
       Prioritizes Groq (for free usage), falls back to OpenAI if Groq key is missing."""
    
    # Try Groq first
    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key and Groq is not None:
        try:
            return Groq(api_key=groq_key), "llama-3.3-70b-versatile"
        except Exception:
            pass
            
    # Fallback to OpenAI
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key and OpenAI is not None:
        try:
            return OpenAI(api_key=openai_key), "gpt-4o-mini"
        except Exception:
            pass
            
    return None, None


def _call_openai(messages: List[Dict], max_tokens: int = 1024, temperature: float = 0.7) -> str:
    """Make a call to the AI API (works dynamically for both Groq and OpenAI)."""
    client, model_name = _get_client_and_model()
    if client is None:
        return ""
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[AI API Error]: {e}")
        return ""


def get_chart_caption(chart_title: str, chart_description: str, data_summary: str) -> str:
    """Generate a 1-2 line AI insight caption for a chart."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior data analyst. Generate a concise 1-2 line insight caption for a chart. "
                "Be specific with numbers and actionable. Do NOT use markdown formatting. "
                "Do NOT start with 'This chart shows'. Instead, state the key finding directly."
            )
        },
        {
            "role": "user",
            "content": (
                f"Chart Title: {chart_title}\n"
                f"Chart Description: {chart_description}\n"
                f"Dataset Context: {data_summary}\n\n"
                "Write a concise 1-2 line analytical insight."
            )
        }
    ]

    result = _call_openai(messages, max_tokens=150, temperature=0.6)
    if not result:
        return f"Key patterns visible in {chart_title.lower()} — explore the data for deeper trends."
    return result


def chat_with_analyst(
    question: str,
    dataset_summary: str,
    chat_history: List[Dict[str, str]],
    sample_data: str = ""
) -> Dict[str, Any]:
    """
    AI chat analyst — answers questions about the dataset.
    Returns dict with 'answer' and optionally 'chart_type' if a chart is implied.
    """
    try:
        from app import store
        if store.get("df_clean") is None:
            return {
                "answer": "Please load a dataset first — upload a CSV or select a sample dataset, and I'll be ready to help!",
                "chart_type": None
            }
        
        # Build fresh summary directly from store to avoid stale context
        eda = store.get("eda_results") or {}
        df_info = eda.get("shape", {})
        dataset_summary = build_dataset_summary(df_info, eda)
    except ImportError:
        pass

    system_prompt = (
        "You are a friendly, concise AI data analyst assistant. "
        "You are having a conversation, not writing a report.\n\n"
        "Rules you must always follow:\n"
        "- Keep every response under 100 words unless the user explicitly asks for more detail\n"
        "- Never list raw column totals or dump statistics unless directly asked\n"
        "- Speak in plain English, not data jargon\n"
        "- Give 2-3 key takeaways maximum per response\n"
        "- Use bullet points only when there are 3 or more items\n"
        "- End with one short actionable recommendation at most\n"
        "- If the user asks a follow-up, go deeper only on that specific point\n"
        "- Never mention column names like 'Unnamed: 0' or internal technical identifiers\n"
        "- If the question implies a chart, include [CHART_SUGGESTED: chart_type] at the end (e.g. bar_chart, line_chart)\n\n"
        "Dataset Context:\n"
        f"{dataset_summary}\n\n"
    )
    
    if sample_data:
        system_prompt += f"Aggregated Data Context:\n{sample_data}\n\n"

    messages = [{"role": "system", "content": system_prompt}]

    # Add chat history (last 10 messages for context window management)
    for msg in chat_history[-10:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })

    messages.append({"role": "user", "content": question})

    result = _call_openai(messages, max_tokens=300, temperature=0.7)

    if not result:
        # Generate a smart offline response from the dataset summary
        result = _generate_offline_response(question, dataset_summary)

    # Parse chart suggestion
    chart_type = None
    if "[CHART_SUGGESTED:" in result:
        try:
            chart_marker = result.split("[CHART_SUGGESTED:")[1].split("]")[0].strip()
            chart_type = chart_marker
            result = result.split("[CHART_SUGGESTED:")[0].strip()
        except (IndexError, ValueError):
            pass

    return {
        "answer": result,
        "chart_type": chart_type
    }


def _generate_offline_response(question: str, dataset_summary: str) -> str:
    """Generate a useful offline response when the AI API is unavailable."""
    q = question.lower()
    
    # Extract info from the summary
    lines = dataset_summary.split("\n")
    stats_section = []
    cat_section = []
    date_section = []
    for line in lines:
        if "mean=" in line or "median=" in line:
            stats_section.append(line.strip())
        elif "unique values" in line:
            cat_section.append(line.strip())
        elif "days" in line.lower() and "to" in line:
            date_section.append(line.strip())
    
    # Try to answer based on question keywords
    if any(w in q for w in ['trend', 'time', 'monthly', 'seasonal', 'forecast']):
        info = date_section[0] if date_section else "date information available in the dataset"
        return (
            f"Based on the dataset, here's what I can share about time trends:\n\n"
            f"- {info}\n"
            f"- Check the Monthly Trend line chart and Seasonal Heatmap for visual patterns.\n"
            f"- The Forecast panel below the charts shows projected values for the next 3 months.\n\n"
            f"Note: The AI service is temporarily at capacity. Please try again in a few minutes for deeper analysis."
        )
    
    if any(w in q for w in ['best', 'top', 'highest', 'category', 'compare', 'performance']):
        info = "\n".join([f"- {c}" for c in cat_section[:3]]) if cat_section else "- Category data is available in the charts"
        return (
            f"Here's what I can share about category performance:\n\n{info}\n\n"
            f"Check the Bar Chart and Pareto Analysis for rankings, and the Radar Chart for multi-metric comparison.\n\n"
            f"Note: The AI service is temporarily at capacity. Please try again shortly for detailed breakdowns."
        )
    
    if any(w in q for w in ['insight', 'finding', 'summary', 'overview', 'heatmap', 'correlation']):
        info = "\n".join([f"- {s}" for s in stats_section[:4]]) if stats_section else "- Statistical data visible in the sidebar"
        return (
            f"Key statistics from the dataset:\n\n{info}\n\n"
            f"The Correlation Heatmap shows relationships between numeric variables. "
            f"Look for values close to 1 (strong positive) or -1 (strong negative).\n\n"
            f"Note: The AI service is temporarily at capacity. Try again soon for AI-powered interpretations."
        )
    
    if any(w in q for w in ['anomal', 'outlier', 'unusual', 'strange']):
        return (
            f"Outlier information is available in the sidebar under 'EDA Report'. "
            f"The IQR method was used to flag outliers across all numeric columns.\n\n"
            f"Check the Box Plot chart - values shown as circles outside the whiskers are potential outliers.\n\n"
            f"Note: The AI service is temporarily at capacity. Please try again soon for deeper anomaly analysis."
        )
    
    # Generic fallback with useful info
    summary_preview = "\n".join(lines[:5]) if lines else "Dataset loaded successfully"
    return (
        f"Here's a quick overview of your data:\n\n{summary_preview}\n\n"
        f"Browse the charts below for visual insights. The sidebar shows detailed EDA results "
        f"including missing values, outliers, and key statistics.\n\n"
        f"Note: The AI service is temporarily at capacity. Your question has been received - "
        f"please try again in a few minutes for a full AI-powered analysis."
    )


def generate_recommendations(dataset_summary: str, eda_results: dict) -> List[Dict[str, str]]:
    """Generate AI business recommendations with severity levels."""
    # Build context from EDA
    context_parts = [dataset_summary]
    if eda_results.get("missing_values"):
        context_parts.append(f"Missing values before cleaning: {eda_results['missing_values'].get('total_before', 0)}")
    if eda_results.get("outliers"):
        outlier_count = sum(o.get("count", 0) for o in eda_results["outliers"].values())
        context_parts.append(f"Outliers flagged: {outlier_count}")
    if eda_results.get("correlation"):
        strong = []
        corr = eda_results["correlation"]
        for c1 in corr:
            for c2, val in corr[c1].items():
                if c1 != c2 and abs(val) > 0.7:
                    strong.append(f"{c1}-{c2}: {val:.2f}")
        if strong:
            context_parts.append(f"Strong correlations: {', '.join(strong[:5])}")

    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior business analyst. Generate 4-6 prioritized business recommendations.\n"
                "For each recommendation, output a JSON object with:\n"
                "- severity: 'critical', 'opportunity', or 'strength'\n"
                "- title: A concise action-oriented title (max 15 words)\n"
                "- description: A specific 1-2 sentence explanation with numbers\n\n"
                "Return ONLY a JSON array of these objects. No markdown, no extra text.\n"
                "Use 'critical' for urgent data issues, 'opportunity' for growth areas, 'strength' for positives."
            )
        },
        {
            "role": "user",
            "content": f"Dataset Analysis:\n{chr(10).join(context_parts)}\n\nGenerate 4-6 business recommendations."
        }
    ]

    result = _call_openai(messages, max_tokens=1200, temperature=0.6)
    if not result:
        return []

    try:
        recs = json.loads(result)
        if isinstance(recs, list) and len(recs) > 0:
            # Validate structure
            valid = []
            for r in recs[:6]:
                if isinstance(r, dict) and "title" in r:
                    valid.append({
                        "severity": r.get("severity", "opportunity"),
                        "title": r.get("title", ""),
                        "description": r.get("description", "")
                    })
            return valid if valid else []
    except (json.JSONDecodeError, TypeError):
        pass

    return []


def generate_key_insights(eda_summary: str, chart_descriptions: List[str]) -> List[str]:
    """Generate 5-8 key analytical insights from the full analysis."""
    charts_text = "\n".join([f"- {desc}" for desc in chart_descriptions]) if chart_descriptions else "No charts available."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior data analyst producing a key insights report. "
                "Generate exactly 6-8 bullet-point insights. Each insight must be:\n"
                "1. Specific (include numbers/percentages where possible)\n"
                "2. Actionable (suggest a business action)\n"
                "3. Clear and concise (1-2 sentences max per insight)\n\n"
                "Format: Return ONLY a JSON array of strings, e.g. [\"insight 1\", \"insight 2\", ...]\n"
                "Do NOT include any markdown formatting or extra text."
            )
        },
        {
            "role": "user",
            "content": (
                f"EDA Summary:\n{eda_summary}\n\n"
                f"Charts Generated:\n{charts_text}\n\n"
                "Generate 6-8 key business insights."
            )
        }
    ]

    result = _call_openai(messages, max_tokens=1200, temperature=0.6)

    if not result:
        return [
            "Data quality improvements needed — missing values and duplicates were detected and handled.",
            "Review outlier records for potential data entry errors or genuinely extreme values.",
            "Explore the strongest correlations to understand key revenue drivers.",
            "Segment analysis reveals performance disparities — consider targeted strategies.",
            "Time-based trends suggest seasonal patterns worth investigating for planning.",
            "Top-performing categories should receive increased investment and focus."
        ]

    try:
        insights = json.loads(result)
        if isinstance(insights, list) and len(insights) > 0:
            return insights[:8]
    except (json.JSONDecodeError, TypeError):
        # Try to parse line by line
        lines = [line.strip().lstrip("•-*0123456789.) ") for line in result.split("\n") if line.strip()]
        lines = [l for l in lines if len(l) > 20]
        if lines:
            return lines[:8]

    return [
        "Data quality improvements needed — missing values and duplicates were detected and handled.",
        "Review outlier records for potential data entry errors or genuinely extreme values.",
        "Explore the strongest correlations to understand key revenue drivers.",
        "Segment analysis reveals performance disparities — consider targeted strategies.",
        "Time-based trends suggest seasonal patterns worth investigating for planning.",
        "Top-performing categories should receive increased investment and focus."
    ]


def generate_forecast_commentary(forecast_summary: str) -> str:
    """Generate a narrative commentary on forecast results."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior data analyst providing forecast commentary. "
                "Write a clear 3-4 sentence analysis of the forecast results. "
                "Include expected growth/decline percentage, key drivers, and a recommendation. "
                "Do NOT use markdown formatting. Be specific with numbers."
            )
        },
        {
            "role": "user",
            "content": f"Forecast Summary:\n{forecast_summary}\n\nProvide analytical commentary."
        }
    ]

    result = _call_openai(messages, max_tokens=400, temperature=0.6)

    if not result:
        return (
            "The forecast model projects a continuation of current trends over the next 3 months. "
            "Consider monitoring key performance indicators closely and adjusting strategy based on "
            "actual vs. projected performance. External market factors may influence actual results."
        )

    return result


def build_dataset_summary(df_info: Dict[str, Any], eda_results: Dict[str, Any]) -> str:
    """Build a comprehensive text summary including full EDA cleaning results."""
    lines = []
    lines.append(f"Dataset: {df_info.get('rows', '?')} rows × {df_info.get('columns', '?')} columns")
    lines.append(f"Columns: {', '.join(df_info.get('column_names', []))}")

    # ── EDA CLEANING SUMMARY ─────────────────────────────────────────────
    lines.append("\n=== DATA CLEANING PERFORMED ===")

    # Duplicates
    dupes = eda_results.get("duplicates", {})
    lines.append(f"Duplicates: {dupes.get('found', 0)} duplicate rows detected and removed. "
                 f"{dupes.get('rows_after', '?')} rows remain after deduplication.")

    # Missing values
    mv = eda_results.get("missing_values", {})
    total_before = mv.get("total_before", 0)
    total_after = mv.get("total_after", 0)
    lines.append(f"Missing Values: {total_before} nulls found before cleaning, "
                 f"{total_after} remaining after filling.")
    strategies = mv.get("strategies", {})
    if strategies:
        lines.append("Fill strategies used per column:")
        for col, strat in strategies.items():
            lines.append(f"  - {col}: filled using {strat}")

    # Type fixes
    type_fixes = eda_results.get("type_fixes", [])
    if type_fixes:
        lines.append(f"Data Type Fixes: {len(type_fixes)} columns corrected:")
        for fix in type_fixes:
            lines.append(f"  - {fix['column']}: {fix['from']} → {fix['to']}")

    # Capitalisation
    cap = eda_results.get("capitalisation", {})
    norm_cols = cap.get("normalised_columns", [])
    if norm_cols:
        lines.append(f"Text Normalisation: {len(norm_cols)} columns standardised "
                     f"to Title Case: {', '.join(norm_cols)}")

    # Outliers
    outliers = eda_results.get("outliers", {})
    if outliers:
        lines.append(f"Outliers: Detected in {len(outliers)} columns via IQR method "
                     f"(flagged but NOT removed):")
        for col, info in outliers.items():
            lines.append(f"  - {col}: {info['count']} outliers "
                         f"(valid range: {info['lower_bound']} to {info['upper_bound']})")
    else:
        lines.append("Outliers: None detected.")

    # ── STATISTICS ───────────────────────────────────────────────────────
    if eda_results.get("summary_stats"):
        lines.append("\n=== KEY STATISTICS ===")
        for col, stats in list(eda_results["summary_stats"].items())[:6]:
            lines.append(f"  {col}: mean={stats.get('mean','?')}, "
                        f"median={stats.get('median','?')}, "
                        f"std={stats.get('std','?')}, "
                        f"min={stats.get('min','?')}, "
                        f"max={stats.get('max','?')}")

    # ── CATEGORICAL INFO ─────────────────────────────────────────────────
    if eda_results.get("categorical_info"):
        lines.append("\n=== CATEGORICAL COLUMNS ===")
        for col, info in list(eda_results["categorical_info"].items())[:5]:
            top = list(info.get("top_values", {}).keys())[:3]
            lines.append(f"  {col}: {info.get('unique_count','?')} unique values "
                         f"(top: {', '.join(top)})")

    # ── DATE INFO ────────────────────────────────────────────────────────
    if eda_results.get("date_info"):
        lines.append("\n=== DATE RANGE ===")
        for col, info in eda_results["date_info"].items():
            lines.append(f"  {col}: {info.get('min','?')} to {info.get('max','?')} "
                         f"({info.get('range_days','?')} days)")

    return "\n".join(lines)

