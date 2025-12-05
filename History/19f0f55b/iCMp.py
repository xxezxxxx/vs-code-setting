import math
import os
from typing import Any, Dict, List, Mapping, Optional, Sequence

import streamlit.components.v1 as components

try:
    import pandas as pd  # type: ignore
except ImportError:  # pragma: no cover
    pd = None  # type: ignore[assignment]

_RELEASE = False

if not _RELEASE:
    _component_func = components.declare_component(
        "table_viewer",
        url="http://localhost:3001",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("table_viewer", path=build_dir)


def _convert_value(value: Any) -> Any:
    """Convert values so they can be safely JSON-serialized by Streamlit."""
    if value is None:
        return None

    if isinstance(value, float) and math.isnan(value):
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")

    if getattr(value, "__float__", None) is not None:
        try:
            numeric = float(value)
            if math.isnan(numeric):
                return None
            return numeric
        except Exception:  # pragma: no cover - fallback guard
            pass

    if hasattr(value, "item"):
        try:
            item = value.item()
            return _convert_value(item)
        except Exception:  # pragma: no cover - fallback guard
            pass

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:  # pragma: no cover - fallback guard
            pass

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_convert_value(v) for v in value]

    return str(value)


def _prepare_table_payload(
    data: Any, columns: Optional[Sequence[str]]
) -> tuple[List[str], List[Dict[str, Any]]]:
    if data is None:
        return list(columns or []), []

    if pd is not None and isinstance(data, pd.DataFrame):
        resolved_columns = list(columns) if columns else data.columns.tolist()
        filtered_columns = [column for column in resolved_columns if column in data.columns]
        if columns and len(filtered_columns) != len(resolved_columns):
            resolved_columns = filtered_columns
        dataframe = data.loc[:, resolved_columns] if resolved_columns else data
        records = dataframe.to_dict(orient="records")
        rows: List[Dict[str, Any]] = []
        for record in records:
            row = {column: _convert_value(record.get(column)) for column in resolved_columns}
            rows.append(row)
        return resolved_columns, rows

    if isinstance(data, Sequence) and not isinstance(data, (str, bytes, bytearray)):
        rows = []
        for entry in data:
            if isinstance(entry, Mapping):
                row = {key: _convert_value(value) for key, value in entry.items()}
                rows.append(row)
        resolved_columns = list(columns) if columns else []
        if not resolved_columns:
            seen: List[str] = []
            for row in rows:
                for key in row:
                    if key not in seen:
                        seen.append(key)
            resolved_columns = seen
        return resolved_columns, rows

    raise TypeError("table_viewer expects a pandas DataFrame or a sequence of mappings")


def table_viewer(
    data: Any,
    columns: Optional[Sequence[str]] = None,
    caption: Optional[str] = None,
    key: Optional[str] = None,
):
    """Render a simple table based on data passed from Python."""
    resolved_columns, rows = _prepare_table_payload(data, columns)
    component_value = _component_func(
        rows=rows,
        columns=resolved_columns,
        caption=caption,
        key=key,
        default=None,
    )
    return component_value


if __name__ == "__main__":
    import pandas as pd

    sample = pd.DataFrame(
        {
            "ts": ["2024-01-01 10:00", "2024-01-01 11:00"],
            "desc": ["First item", "Second item"],
            "link": [
                "https://example.com/notifications/1",
                "https://example.com/tasks/42",
            ],
            "Close_Time":["2024-01-01 10:04", "2024-01-01 11:02"],
        }
    )

    table_viewer(sample, key="demo")
