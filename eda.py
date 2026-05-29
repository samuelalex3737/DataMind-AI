"""
DataMind AI — EDA Pipeline Module
Comprehensive automated Exploratory Data Analysis.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple


def _detect_date_columns(df: pd.DataFrame) -> List[str]:
    """Detect columns that can be parsed as dates."""
    date_cols = []
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            date_cols.append(col)
            continue
        if df[col].dtype == object:
            sample = df[col].dropna().head(20)
            if len(sample) == 0:
                continue
            try:
                parsed = pd.to_datetime(sample, errors='coerce')
                if parsed.notna().sum() >= len(sample) * 0.8:
                    date_cols.append(col)
            except (ValueError, TypeError):
                continue
    return date_cols


def _detect_numeric_string_columns(df: pd.DataFrame) -> List[str]:
    """Detect object columns that should be numeric."""
    numeric_str_cols = []
    for col in df.columns:
        if df[col].dtype == object:
            sample = df[col].dropna().head(30)
            if len(sample) == 0:
                continue
            try:
                converted = pd.to_numeric(sample, errors='coerce')
                if converted.notna().sum() >= len(sample) * 0.8:
                    numeric_str_cols.append(col)
            except (ValueError, TypeError):
                continue
    return numeric_str_cols


def run_full_eda(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Run a thorough EDA pipeline on the given DataFrame.
    Returns a comprehensive results dictionary.
    """
    results = {}
    df = df.copy()

    # =========================================================================
    # 1. SHAPE & OVERVIEW
    # =========================================================================
    dtypes_dict = df.dtypes.astype(str).to_dict()
    dtype_counts = {}
    for dtype_str in dtypes_dict.values():
        key = str(dtype_str)
        dtype_counts[key] = dtype_counts.get(key, 0) + 1

    results["shape"] = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": list(df.columns),
        "dtypes": dtypes_dict,
        "dtype_counts": dtype_counts,
        "memory_usage_mb": round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
    }

    # =========================================================================
    # 2. DATA TYPE FIXING (before missing value analysis)
    # =========================================================================
    type_fixes = []

    # Detect and convert date columns
    date_cols = _detect_date_columns(df)
    for col in date_cols:
        if not pd.api.types.is_datetime64_any_dtype(df[col]):
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce')
                type_fixes.append({"column": col, "from": "object", "to": "datetime64"})
            except Exception:
                pass

    # Detect and convert numeric string columns
    numeric_str_cols = _detect_numeric_string_columns(df)
    for col in numeric_str_cols:
        if col not in date_cols:
            try:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                type_fixes.append({"column": col, "from": "object", "to": "float64"})
            except Exception:
                pass

    results["type_fixes"] = type_fixes

    # =========================================================================
    # 3. MISSING VALUES — BEFORE
    # =========================================================================
    missing_before = df.isnull().sum().to_dict()
    missing_before = {k: int(v) for k, v in missing_before.items() if v > 0}
    total_missing_before = int(df.isnull().sum().sum())

    # Fill strategies
    fill_strategies = {}
    for col in df.columns:
        if df[col].isnull().sum() == 0:
            continue

        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].ffill()
            if df[col].isnull().sum() > 0:
                df[col] = df[col].bfill()
            fill_strategies[col] = "forward-fill (then back-fill)"
        elif pd.api.types.is_numeric_dtype(df[col]):
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
            fill_strategies[col] = f"median ({median_val:.2f})"
        else:
            mode_vals = df[col].mode()
            if len(mode_vals) > 0:
                df[col] = df[col].fillna(mode_vals[0])
                fill_strategies[col] = f"mode ('{mode_vals[0]}')"
            else:
                df[col] = df[col].fillna("Unknown")
                fill_strategies[col] = "fallback ('Unknown')"

    missing_after = df.isnull().sum().to_dict()
    missing_after = {k: int(v) for k, v in missing_after.items() if v > 0}
    total_missing_after = int(df.isnull().sum().sum())

    results["missing_values"] = {
        "before": missing_before,
        "after": missing_after,
        "total_before": total_missing_before,
        "total_after": total_missing_after,
        "strategies": fill_strategies
    }

    # =========================================================================
    # 4. DUPLICATES
    # =========================================================================
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        df = df.drop_duplicates().reset_index(drop=True)

    results["duplicates"] = {
        "found": dup_count,
        "removed": dup_count,
        "rows_after": int(len(df))
    }

    # =========================================================================
    # 5. CAPITALISATION NORMALISATION
    # =========================================================================
    normalised_cols = []
    for col in df.columns:
        if df[col].dtype == object:
            try:
                # Skip free text or high-cardinality columns for performance
                if df[col].nunique() > 1000:
                    continue
                    
                before_sample = df[col].dropna().head(5).tolist()
                
                # Optimised transformation using categories (instant for millions of rows)
                cat_col = df[col].astype('category')
                new_categories = [str(x).strip().title() if pd.notna(x) else x for x in cat_col.cat.categories]
                cat_col = cat_col.cat.rename_categories(new_categories)
                df[col] = cat_col.astype(object)
                
                after_sample = df[col].dropna().head(5).tolist()
                if before_sample != after_sample:
                    normalised_cols.append(col)
            except Exception:
                pass

    results["capitalisation"] = {
        "normalised_columns": normalised_cols,
        "method": "Title Case"
    }

    # =========================================================================
    # 6. OUTLIER DETECTION (IQR method)
    # =========================================================================
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    outlier_info = {}

    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
        outlier_count = int(outlier_mask.sum())
        if outlier_count > 0:
            outlier_info[col] = {
                "count": outlier_count,
                "percentage": round(outlier_count / len(df) * 100, 1),
                "lower_bound": round(float(lower_bound), 2),
                "upper_bound": round(float(upper_bound), 2),
                "Q1": round(float(Q1), 2),
                "Q3": round(float(Q3), 2),
                "IQR": round(float(IQR), 2)
            }
        # Flag but do NOT remove
        df[f"_{col}_outlier"] = outlier_mask

    results["outliers"] = outlier_info

    # =========================================================================
    # 7. SUMMARY STATISTICS
    # =========================================================================
    summary_stats = {}
    for col in numeric_cols:
        stats = df[col].describe()
        summary_stats[col] = {
            "count": int(stats.get("count", 0)),
            "mean": round(float(stats.get("mean", 0)), 2),
            "std": round(float(stats.get("std", 0)), 2),
            "min": round(float(stats.get("min", 0)), 2),
            "25%": round(float(stats.get("25%", 0)), 2),
            "median": round(float(df[col].median()), 2),
            "75%": round(float(stats.get("75%", 0)), 2),
            "max": round(float(stats.get("max", 0)), 2)
        }

    results["summary_stats"] = summary_stats

    # =========================================================================
    # 8. CORRELATION MATRIX
    # =========================================================================
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr()
        corr_dict = {}
        for col in corr.columns:
            corr_dict[col] = {k: round(float(v), 3) for k, v in corr[col].items()}
        results["correlation"] = corr_dict
    else:
        results["correlation"] = {}

    # =========================================================================
    # Store categorical column info
    # =========================================================================
    cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
    cat_info = {}
    for col in cat_cols:
        value_counts = df[col].value_counts().head(10).to_dict()
        cat_info[col] = {
            "unique_count": int(df[col].nunique()),
            "top_values": {str(k): int(v) for k, v in value_counts.items()}
        }
    results["categorical_info"] = cat_info

    # Store date column info
    date_cols_final = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    date_info = {}
    for col in date_cols_final:
        date_info[col] = {
            "min": str(df[col].min()),
            "max": str(df[col].max()),
            "range_days": int((df[col].max() - df[col].min()).days) if pd.notna(df[col].min()) and pd.notna(df[col].max()) else 0
        }
    results["date_info"] = date_info

    # Drop outlier flag columns before returning cleaned df
    outlier_flag_cols = [c for c in df.columns if c.startswith("_") and c.endswith("_outlier")]
    df_clean = df.drop(columns=outlier_flag_cols, errors='ignore')

    return results, df_clean
