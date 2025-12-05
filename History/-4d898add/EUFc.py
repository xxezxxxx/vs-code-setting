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
    report_cache: Optional[List[Dict[str, Any]]] = None,
    active_report_index: Optional[int] = None,
    # Behavior controls
    emit_copy_events: Optional[bool] = None,
    emit_shortlog_events: Optional[bool] = None,
    selection_debounce_ms: Optional[int] = None,
    shortlog_debounce_ms: Optional[int] = None,
    filter_config: Optional[Dict[str, Any]] = None,
    search_config: Optional[Dict[str, Any]] = None,
    ui_theme: Optional[Dict[str, Any]] = None,
    auto_emit_initial: Optional[bool] = True,
    shortlog_style_rules: Optional[List[Dict[str, Any]]] = None,
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
        report_cache: Optional list of per-report payloads for instant client-side switching.
            Each item: {"detail_html": str, "short": DataFrame/Series/list, "detail": DataFrame/Series/list}
        active_report_index: Optional currently selected report index to highlight/use on the client.
        emit_copy_events: If True, copy events are sent back to Python. Defaults to False to avoid reruns on copy.
        emit_shortlog_events: If True, short log row selection events are sent. Defaults to False per your request.
        selection_debounce_ms: Debounce delay for report selection events. Defaults ~200ms.
        shortlog_debounce_ms: Debounce delay for shortlog selection events. Defaults ~120ms.
        filter_config: e.g. {"columns": ["level", "module"], "initial": {"level": ["ERROR"]}}
        search_config: e.g. {"columns": ["message", "context"], "initial": "failed"}
        ui_theme: e.g. {"accentColor": "#1976d2"}
        auto_emit_initial: If True (default), emits initial report_selected once on first render.
        shortlog_style_rules: Optional styling rules for short log rows. Example:
            [
              {"column": "level", "equals": ["ERROR"], "backgroundColor": "#ffebee", "color": "#c62828", "badge": True},
              {"column": "level", "equals": ["WARN", "WARNING"], "backgroundColor": "#fff8e1", "color": "#f57c00", "badge": True},
              {"column": "level", "equals": ["INFO"], "backgroundColor": "#e3f2fd", "color": "#1565c0", "badge": True},
            ]
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
        "report_cache": None
        if not report_cache
        else [
            {
                "detail_html": (item.get("detail_html") if isinstance(item, dict) else None),
                "short": _normalize_table((item.get("short") if isinstance(item, dict) else None)),
                "detail": _normalize_table((item.get("detail") if isinstance(item, dict) else None)),
            }
            for item in report_cache
        ],
        "active_report_index": active_report_index,
        "emit_copy_events": emit_copy_events,
        "emit_shortlog_events": emit_shortlog_events,
        "selection_debounce_ms": selection_debounce_ms,
        "shortlog_debounce_ms": shortlog_debounce_ms,
        "filter_config": filter_config,
        "search_config": search_config,
        "ui_theme": ui_theme,
        "auto_emit_initial": auto_emit_initial,
        "shortlog_style_rules": shortlog_style_rules,
    }

    component_value = _component_func(
        **payload,
        key=key,
        default=default_event or {"type": "init"},
    )
    return component_value


if __name__ == "__main__":
    # Interactive demo with aligned short/detail logs per report
    import streamlit as st

    st.set_page_config(layout="wide")

    try:
        import pandas as pd
    except Exception:
        pd = None

    # Cache demo data and conversions to keep reruns fast
    import streamlit as st

    if pd is not None:
        @st.cache_data(show_spinner=False)
        def _to_df(obj):
            return pd.DataFrame(obj)

        @st.cache_data(show_spinner=False)
        def _report_list_df(reports: list[dict]):
            return pd.DataFrame([r["report"] for r in reports])
    else:
        def _to_df(obj):
            return obj
        def _report_list_df(reports: list[dict]):
            return [r["report"] for r in reports]

    @st.cache_data(show_spinner=False)
    def _demo_reports() -> list[dict]:
        data: list[dict] = [
            {
                "report": {"name": "Alpha", "date": "2025-01-10", "path1": "/a/b", "path2": "/c/d"},
                "detail_html": """
                    <div style='font-family:Arial'>
                        <style>
                            .hl-red { background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }
                            .hl-blue { background:#e3f2fd; color:#1565c0; padding:2px 4px; border-radius:4px; }
                            .note { color:#555; font-size:13px; }
                        </style>
                        <h3>Alpha Report</h3>
                        <p><b>Summary:</b> Alpha run completed with <span class='hl-red'>warnings</span>.</p>
                        <ul>
                          <li>Init OK</li>
                          <li>Processed <span class='hl-blue'>120</span> items</li>
                          <li><span class='hl-red'>2 warnings</span></li>
                        </ul>
                        <p class='note'>This is a <span class='hl-blue'>demo highlight</span> to preview copy behavior.</p>
                    </div>
                """,
                "short": [
                    {"ts": "10:00:01", "level": "INFO", "message": "Start", "line": 1},
                    {"ts": "10:00:05", "level": "INFO", "message": "Loading", "line": 2},
                    {"ts": "10:00:12", "level": "WARN", "message": "Slow network", "line": 3},
                    {"ts": "10:00:20", "level": "INFO", "message": "Done", "line": 4},
                ],
                "detail": [
                    {"ts": "10:00:01", "message": "Start", "full": "Job started by user alpha", "line": 1},
                    {"ts": "10:00:05", "message": "Loading", "full": "Loading resources from S3 bucket...", "line": 2},
                    {"ts": "10:00:12", "message": "Slow network", "full": "Download slowed below 1MB/s", "line": 3},
                    {"ts": "10:00:20", "message": "Done", "full": "Job finished in 19s", "line": 4},
                ],
            },
            {
                "report": {"name": "Beta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
                "detail_html": """
                    <div style='font-family:Arial'>
                        <style>
                            .hl-red { background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }
                            .hl-blue { background:#e3f2fd; color:#1565c0; padding:2px 4px; border-radius:4px; }
                            .note { color:#555; font-size:13px; }
                        </style>
                        <h3>Beta Report</h3>
                        <p><b>Summary:</b> Beta run failed with <span class='hl-red'>errors</span>.</p>
                        <ul>
                          <li>Init OK</li>
                          <li>Processed <span class='hl-blue'>23</span> items</li>
                          <li><span class='hl-red'>1 error</span></li>
                        </ul>
                        <p class='note'>Highlighted words will remain highlighted when copied.</p>
                    </div>
                """,
                "short": [
                    {"ts": "11:00:01", "level": "INFO", "message": "Start", "line": 1},
                    {"ts": "11:00:04", "level": "ERROR", "message": "DB connect fail", "line": 2},
                    {"ts": "11:00:04", "level": "INFO", "message": "Retrying", "line": 3},
                    {"ts": "11:00:06", "level": "ERROR", "message": "DB connect timeout", "line": 4},
                ],
                "detail": [
                    {"ts": "11:00:01", "message": "Start", "full": "Job started by user beta", "line": 1},
                    {"ts": "11:00:04", "message": "DB connect fail", "full": "psycopg2.OperationalError ...", "line": 2},
                    {"ts": "11:00:04", "message": "Retrying", "full": "Reattempting connection (1/3)", "line": 3},
                    {"ts": "11:00:06", "message": "DB connect timeout", "full": "Connection timed out after 2s", "line": 4},
                ],
            },
        ]
        for i in range(3, 21):
            name = f"Report {i:02d}"
            date = f"2025-01-{10 + (i % 20):02d}"
            short = [
                {
                    "ts": f"{12 + (i % 6):02d}:{(j // 60):02d}:{(j % 60):02d}",
                    "level": ["INFO", "WARN", "ERROR"][j % 3],
                    "message": f"{name} short log line {j}",
                    "line": j,
                }
                for j in range(1, 26)
            ]
            detail = [
                {
                    "ts": s["ts"],
                    "message": s["message"],
                    "full": f"Full detail for {name} line {s['line']}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.",
                    "line": s["line"],
                }
                for s in short
            ]
            html = f"""
                <div style='font-family:Arial'>
                    <style>
                        .hl-red {{ background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }}
                        .hl-blue {{ background:#e3f2fd; color:#1565c0; padding:2px 4px; border-radius:4px; }}
                    </style>
                    <h3>{name}</h3>
                    <p><b>Summary:</b> Demo <span class='hl-blue'>auto-generated</span> report with <span class='hl-red'>highlights</span>.</p>
                </div>
            """
            data.append({
                "report": {"name": name, "date": date, "path1": f"/auto/{i}/x", "path2": f"/auto/{i}/y"},
                "detail_html": html,
                "short": short,
                "detail": detail,
            })
        return data

    # Fallback-safe rerun
    def _rerun():
        try:
            st.rerun()  # streamlit >= 1.27
        except Exception:
            try:
                st.experimental_rerun()  # older versions
            except Exception:
                pass

    st.write("Demo: my_viewer (Report list + Short/Detail sync)")

    # Sample reports with per-report logs (cached)
    reports_data = _demo_reports()

    # Build report list table (DataFrame if pandas present)
    report_list = _report_list_df(reports_data)

    # Single-phase demo: first render returns and renders the first report
    if "selected_report_idx" not in st.session_state:
        st.session_state["selected_report_idx"] = 0

    sel = int(st.session_state["selected_report_idx"]) if st.session_state.get("selected_report_idx") is not None else 0
    sel = max(0, min(sel, len(reports_data) - 1))
    cur = reports_data[sel]

    short_logs = cur["short"]
    detail_logs = cur["detail"]
    if pd is not None:
        try:
            short_logs = pd.DataFrame(short_logs)
            detail_logs = pd.DataFrame(detail_logs)
        except Exception:
            pass

    event = my_viewer(
        report_list=report_list,
        report_list_schema={
            "name": "name",
            "date": "date",
            "path1": "path1",
            "path2": "path2",
        },
        report_detail_html=cur["detail_html"],
        error_log_short=short_logs,
        error_log_detail=detail_logs,
        active_report_index=sel,
        auto_emit_initial=True,
        emit_copy_events=False,
        emit_shortlog_events=False,
        selection_debounce_ms=0,
        shortlog_debounce_ms=140,
        shortlog_style_rules=[
            {"column": "level", "equals": ["ERROR"], "backgroundColor": "#ffebee", "color": "#c62828", "badge": True},
            {"column": "level", "equals": ["WARN", "WARNING"], "backgroundColor": "#fff8e1", "color": "#f57c00", "badge": True},
            {"column": "level", "equals": ["INFO"], "backgroundColor": "#e3f2fd", "color": "#1565c0", "badge": True},
        ],
        filter_config={"columns": ["level"]},
        search_config={"columns": ["message"], "placeholder": "Search message..."},
        ui_theme={"accentColor": "#1976d2"},
        key="my_viewer_demo",
    )

    # Handle events: update selection only when changed
    if isinstance(event, dict) and event.get("type") == "report_selected":
        idx = int(event.get("rowIndex", 0))
        if idx != sel:
            st.session_state["selected_report_idx"] = idx
            _rerun()
