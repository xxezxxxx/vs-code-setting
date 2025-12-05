import os
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple
import streamlit.components.v1 as components

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


def _serialize_df(
    df: Any,
) -> Tuple[Optional[List[Mapping[str, Any]]], Optional[List[str]]]:
    """DataFrame-like 媛앹껜瑜?媛?ν븳 ???덉쟾?섍쾶 吏곷젹?뷀빀?덈떎.

    諛섑솚媛믪? (records, columns) ?낅땲??
    - pandas.DataFrame?대㈃ to_dict(orient="records")濡?蹂??    - list[dict] ?뺥깭硫?洹몃?濡??ъ슜
    - 洹??몄뿉??(None, None)
    """
    if df is None:
        return None, None

    # pandas媛 ?ㅼ튂?섏뼱 ?덇퀬, DataFrame??寃쎌슦 ?곗꽑 泥섎━
    try:
        import pandas as pd  # type: ignore

        if isinstance(df, pd.DataFrame):
            records = df.to_dict(orient="records")  # type: ignore[no-any-return]
            columns = list(df.columns)
            return records, columns
    except Exception:
        # pandas 誘몄꽕移??먮뒗 DataFrame???꾨땶 寃쎌슦 怨꾩냽 吏꾪뻾
        pass

    # list[dict] ?뺥깭 泥섎━
    if isinstance(df, Iterable) and not isinstance(df, (str, bytes, dict)):
        try:
            records = list(df)  # type: ignore[var-annotated]
            if records and isinstance(records[0], Mapping):
                columns = list(records[0].keys())
                return records, columns
        except Exception:
            pass

    # to_dict(orient="records")瑜?吏?먰븯??媛앹껜
    if hasattr(df, "to_dict"):
        try:
            records = df.to_dict(orient="records")  # type: ignore[attr-defined]
            columns = list(records[0].keys()) if records else None
            return records, columns
        except Exception:
            pass

    return None, None


# ---- Theme presets and resolver ----
_THEME_PRESETS: Dict[str, Dict[str, str]] = {
    "blue": {"accentColor": "#1976d2"},
    "indigo": {"accentColor": "#3f51b5"},
    "cyan": {"accentColor": "#00acc1"},
    "teal": {"accentColor": "#009688"},
    "green": {"accentColor": "#43a047"},
    "orange": {"accentColor": "#fb8c00"},
    "red": {"accentColor": "#e53935"},
    "pink": {"accentColor": "#d81b60"},
    "gray": {"accentColor": "#607d8b"},
    "slate": {"accentColor": "#475569"},
    "violet": {"accentColor": "#7c4dff"},
}


def _hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    s = hex_str.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    if len(s) != 6:
        return (25, 118, 210)  # default to #1976d2
    try:
        r = int(s[0:2], 16)
        g = int(s[2:4], 16)
        b = int(s[4:6], 16)
        return (r, g, b)
    except Exception:
        return (25, 118, 210)


def _resolve_ui_theme(ui_theme: Optional[Any]) -> Dict[str, Any]:
    """Normalize ui_theme into a dict with sensible defaults.

    Accepts:
    - str preset name (e.g., "blue", "indigo")
    - dict with optional keys (accentColor, backgroundColor, ...)
    """
    preset: Optional[str] = None
    if isinstance(ui_theme, str):
        preset = ui_theme.strip().lower()
        base: Dict[str, Any] = {}
    elif isinstance(ui_theme, dict):
        base = dict(ui_theme)
        p = base.get("preset") or base.get("name")
        if isinstance(p, str):
            preset = p.strip().lower()
    else:
        base = {}

    if preset and preset in _THEME_PRESETS:
        base = {**_THEME_PRESETS[preset], **base}

    accent = str(base.get("accentColor") or "#1976d2")
    r, g, b = _hex_to_rgb(accent)
    row_alt = base.get("rowAlt") or f"rgba({r},{g},{b},0.03)"
    hover = base.get("hover") or f"rgba({r},{g},{b},0.07)"

    out: Dict[str, Any] = {"accentColor": accent}
    # Optional overrides: only include if provided; front has fallbacks
    for k in (
        "backgroundColor",
        "secondaryBackgroundColor",
        "textColor",
        "borderColor",
    ):
        if base.get(k) is not None:
            out[k] = base[k]
    out["rowAlt"] = row_alt
    out["hover"] = hover
    return out


def table_viewer(
    name: Optional[str] = None,
    *,
    data: Any = None,
    df: Any = None,
    columns: Optional[List[str]] = None,
    ui_theme: Optional[Dict[str, Any]] = None,
    key: Optional[str] = None,
    default: Any = None,
    **kwargs: Any,
):
    """?뚯씠釉?酉곗뼱 而댄룷?뚰듃瑜??뚮뜑留곹빀?덈떎.

    Parameters
    ----------
    name : Optional[str]
        ?ㅻ뜑/??댄?濡??쒖떆??臾몄옄??
    data : Any
        而댄룷?뚰듃濡??꾨떖???꾩쓽???곗씠???ㅼ젙 媛?
    df : Any
        ?쒕줈 ?뚮뜑留곹븷 ?곗씠?? ?ㅼ쓬 ???吏??
        - pandas.DataFrame
        - list[dict]
    columns : Optional[list[str]]
        紐낆떆??而щ읆 ?쒖꽌/?대쫫. 誘몄?????df?먯꽌 異붾줎.
    ui_theme : Optional[Dict[str, Any]]
        UI ?뚮쭏 ?ㅻ쾭?쇱씠?? ?ㅼ쓬 ??吏??
        - accentColor: 湲곕낯 踰꾪듉/媛뺤“ ??(湲곕낯: #1976d2)
        - backgroundColor: ?섏씠吏 諛곌꼍 (湲곕낯: Streamlit theme ?먮뒗 #ffffff)
        - secondaryBackgroundColor: 移대뱶/而⑦뀒?대꼫 諛곌꼍 (湲곕낯: Streamlit theme ?먮뒗 #ffffff)
        - textColor: ?띿뒪????(湲곕낯: Streamlit theme ?먮뒗 #262730)
        - borderColor: ?뚮몢由???(湲곕낯: #E6E6E9)
        - rowAlt: ?뚯씠釉?吏앹닔??諛곌꼍 (湲곕낯: rgba(25,118,210,0.03))
        - hover: ??hover 諛곌꼍 (湲곕낯: rgba(25,118,210,0.07))
    key : Optional[str]
        Streamlit 而댄룷?뚰듃 key.
    default : Any
        而댄룷?뚰듃媛 媛믪쓣 ?ㅼ젙?섍린 ??湲곕낯 諛섑솚媛?
    """

    records, inferred_cols = _serialize_df(df)
    if columns is None:
        columns = inferred_cols

    # Support alias: UI_THEME (uppercase) for convenience
    if ui_theme is None and isinstance(kwargs.get("UI_THEME"), (str, dict)):
        ui_theme = kwargs.get("UI_THEME")  # type: ignore[assignment]

    theme_payload = _resolve_ui_theme(ui_theme)

    component_value = _component_func(
        name=name,
        data=data,
        df=records,
        columns=columns,
        ui_theme=theme_payload,
        key=key,
        default=default,
    )

    return component_value


if __name__ == "__main__":
    import streamlit as st

    # ?곕え ?곗씠?? ?꾩옱 ?묒꽦?섏떊 data/df ?먮━???곌껐???ъ슜?섏떆硫??⑸땲??
    data = {
        "source": "demo",
        "note": "?꾩쓽 硫뷀??곗씠??",
    }

    df = [
        {"EQP": "A1234", "desc": "A1234 議곗튂 : 鍮꾩긽 ?쒖같", "TS": "2024/05/19-23:59:00", "link": "http://demo1~"},
        {"EQP": "A1234", "desc": "A1234 議곗튂 : 踰좎뼱留?援먯껜", "TS": "2024/05/18-23:59:00", "link": "http://demo2~"},
        {"EQP": "A1234", "desc": "A1234 議곗튂 : ?듭떊 紐⑤뱢 ?먭?", "TS": "2024/05/12-23:59:00", "link": "http://demo3~"},
        {"EQP": "B1234", "desc": "B1234 議곗튂", "TS": "2024/05/18-23:59:00", "link": "http://demo4~"},
        {"EQP": "C1234", "desc": "C1234 議곗튂", "TS": "2024/05/16-23:59:00", "link": "http://demo5~"},
        {"EQP": "D1234", "desc": "D1234 議곗튂", "TS": "2024/05/14-23:59:00", "link": "http://demo6~"},
    ]

    result = table_viewer(
        name="DEMO VIEWER",
        data=data,
        df=df,
        ui_theme="blue",
        key="demo",
        default=None,
    )

    st.write("Component returned:", result)


