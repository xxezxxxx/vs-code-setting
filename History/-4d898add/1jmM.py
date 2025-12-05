import os
from typing import Any, Dict, List, Optional
import streamlit.components.v1 as components


_RELEASE = False


if not _RELEASE:
    _component_func = components.declare_component(
        "my_viewer",
        url="http://localhost:3001",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("my_viewer", path=build_dir)


def _try_imports():
    try:
        import pandas as pd  # type: ignore
    except Exception:  # pragma: no cover - optional
        pd = None  # type: ignore
    try:
        import numpy as np  # type: ignore
    except Exception:  # pragma: no cover - optional
        np = None  # type: ignore
    return pd, np


def _cast_value(v: Any) -> Any:
    """Cast values to JSON-serializable primitives.

    - numpy scalars -> python scalars
    - pandas/np NaN/NaT -> None
    - timestamps/paths/other -> str
    """
    pd, np = _try_imports()
    try:
        if v is None:
            return None
        if pd is not None and (v is pd.NaT):  # type: ignore[attr-defined]
            return None
        if np is not None:
            if getattr(np, "isnan", None) is not None:
                try:
                    if np.isnan(v):  # type: ignore[arg-type]
                        return None
                except Exception:
                    pass
            if isinstance(v, getattr(np, "integer", tuple())):
                try:
                    return v.item()
                except Exception:
                    return int(v)
            if isinstance(v, getattr(np, "floating", tuple())):
                try:
                    return v.item()
                except Exception:
                    return float(v)
        # Native primitives
        if isinstance(v, (bool, int, float, str)):
            return v
        # Datetime-like -> ISO string
        for attr in ("isoformat", "ctime", "__str__"):
            if hasattr(v, attr):
                try:
                    if attr == "isoformat":
                        return getattr(v, attr)()
                except Exception:
                    pass
        # Fallback string cast
        return str(v)
    except Exception:
        return str(v)


def _normalize_table(data: Any) -> Optional[Dict[str, Any]]:
    """Normalize pandas DataFrame/Series or list/dicts into a frontend-friendly shape.

    Returns a dict with keys: {"records": List[Dict[str, Any]], "columns": List[str]}
    or None if data is None.
    """
    if data is None:
        return None

    pd, _ = _try_imports()

    # pandas.DataFrame
    if pd is not None and isinstance(data, pd.DataFrame):  # type: ignore[attr-defined]
        try:
            df = data.copy()
            # Replace pandas NA/NaT with None for JSON
            try:
                df = df.where(df.notna(), None)
            except Exception:
                pass
            records: List[Dict[str, Any]] = df.to_dict(orient="records")  # type: ignore[assignment]
            records = [
                {k: _cast_value(v) for k, v in row.items()}
                for row in records
            ]
            columns = [str(c) for c in list(df.columns)]
            return {"records": records, "columns": columns}
        except Exception:
            # Fallback: best-effort stringification
            try:
                records = [
                    {str(k): _cast_value(v) for k, v in row.items()}
                    for row in data.to_dict(orient="records")  # type: ignore[attr-defined]
                ]
                columns = [str(c) for c in list(data.columns)]  # type: ignore[attr-defined]
                return {"records": records, "columns": columns}
            except Exception:
                pass

    # pandas.Series
    if pd is not None and isinstance(data, pd.Series):  # type: ignore[attr-defined]
        try:
            s = data.copy()
            try:
                s = s.where(s.notna(), None)
            except Exception:
                pass
            records = [
                {"index": _cast_value(i), "value": _cast_value(v)} for i, v in s.items()
            ]
            return {"records": records, "columns": ["index", "value"]}
        except Exception:
            pass

    # List of dicts
    if isinstance(data, list) and (len(data) == 0 or isinstance(data[0], dict)):
        records = [
            {str(k): _cast_value(v) for k, v in row.items()}  # type: ignore[attr-defined]
            for row in data
        ]
        # Collect columns as union of keys
        columns_set = set()
        for r in records:
            columns_set.update(r.keys())
        return {"records": records, "columns": list(columns_set)}

    # List of primitives -> map to {value}
    if isinstance(data, list):
        records = [{"value": _cast_value(v)} for v in data]
        return {"records": records, "columns": ["value"]}

    # Dict of lists -> try to make columns
    if isinstance(data, dict):
        try:
            # transpose into records
            keys = list(data.keys())
            length = max((len(v) for v in data.values() if isinstance(v, list)), default=0)
            recs: List[Dict[str, Any]] = []
            for i in range(length):
                recs.append({k: _cast_value((data.get(k) or [None] * length)[i]) for k in keys})
            return {"records": recs, "columns": keys}
        except Exception:
            pass

    # Fallback single value -> one-row table
    return {"records": [{"value": _cast_value(data)}], "columns": ["value"]}


def my_viewer(
    *,
    report_list: Any | None = None,
    report_list_schema: Optional[Dict[str, str]] = None,
    report_detail_html: Optional[str] = None,
    error_log_short: Any | None = None,
    error_log_detail: Any | None = None,
    filter_config: Optional[Dict[str, Any]] = None,
    search_config: Optional[Dict[str, Any]] = None,
    ui_theme: Optional[Dict[str, Any]] = None,
    key: Optional[str] = None,
    default_event: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any] | Any:
    """Render the custom 4-panel viewer and return user events.

    Args:
        report_list: pandas.DataFrame/Series/list representing the list of reports.
        report_list_schema: Optional mapping of logical fields -> column names, e.g.
            {"name": "name", "date": "date", "path1": "path1", "path2": "path2"}
        report_detail_html: Pre-rendered HTML for the selected report (left-bottom panel).
        error_log_short: Short log (list/Series/DataFrame) for the selected report (right-bottom).
        error_log_detail: Full log (list/Series/DataFrame) for the selected log row (right-top).
        filter_config: e.g. {"columns": ["level", "module"], "initial": {"level": ["ERROR"]}}
        search_config: e.g. {"columns": ["message", "context"], "initial": "failed"}
        ui_theme: e.g. {"accentColor": "#1976d2"}
        key: Streamlit component key
        default_event: Default return value before any user interaction

    Returns:
        A dict event such as:
        {"type": "report_selected", "rowIndex": int, "row": {...}}
        {"type": "shortlog_row_selected", "rowIndex": int, "row": {...}}
        {"type": "copied", "target": "report_detail"|"detail_log"}
    """

    payload: Dict[str, Any] = {
        "report_list": _normalize_table(report_list),
        "report_list_schema": report_list_schema,
        "report_detail_html": report_detail_html,
        "error_log_short": _normalize_table(error_log_short),
        "error_log_detail": _normalize_table(error_log_detail),
        "filter_config": filter_config,
        "search_config": search_config,
        "ui_theme": ui_theme,
    }

    component_value = _component_func(
        **payload,
        key=key,
        default=default_event or {"type": "init"},
    )
    return component_value


if __name__ == "__main__":
    # Minimal demo (runs only when executing this file directly)
    import streamlit as st

    st.set_page_config(
        layout="wide"
    )



    try:
        import pandas as pd
    except Exception:
        pd = None

    st.write("Demo: my_viewer")
    if pd is not None:
        df_reports = pd.DataFrame(
            [
                {"name": "Alpha", "date": "2025-01-10", "path1": "/a/b", "path2": "/c/d"},
                {"name": "Beta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
                {"name": "Ceta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
            ]
        )
    else:
        df_reports = [
            {"name": "Alpha", "date": "2025-01-10", "path1": "/a/b", "path2": "/c/d"},
            {"name": "Beta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
            {"name": "Ceta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
        ]

    event = my_viewer(
        report_list=df_reports,
        report_list_schema={"name": "name", "date": "date", "path1": "path1", "path2": "path2"},
        report_detail_html="""
            <div style='font-family:Arial'>
                <h3>Report Detail</h3>
                <p><b>Summary:</b> This is a demo report.</p>
                <ul><li>Point A</li><li>Point B</li></ul>
            </div>
        """,
        error_log_short=[
            {"level": "INFO", "message": "Starting job", "line": 1},
            {"level": "ERROR", "message": "Something failed", "line": 2},
            {"level": "WARN", "message": "Retrying", "line": 3},
        ],
        error_log_detail=[{"detail": "Select a short log line to view full details."}],
        filter_config={"columns": ["level"]},
        search_config={"columns": ["message"], "placeholder": "Search message..."},
        ui_theme={"accentColor": "#1976d2"},
        key="my_viewer_demo",
    )

    st.write("Event:", event)
