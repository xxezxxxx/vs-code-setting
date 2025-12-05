import os
from typing import Any, Iterable, List, Mapping, Optional, Tuple
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
    """DataFrame-like 객체를 가능한 한 안전하게 직렬화합니다.

    반환값은 (records, columns) 입니다.
    - pandas.DataFrame이면 to_dict(orient="records")로 변환
    - list[dict] 형태면 그대로 사용
    - 그 외에는 (None, None)
    """
    if df is None:
        return None, None

    # pandas가 설치되어 있고, DataFrame인 경우 우선 처리
    try:
        import pandas as pd  # type: ignore

        if isinstance(df, pd.DataFrame):
            records = df.to_dict(orient="records")  # type: ignore[no-any-return]
            columns = list(df.columns)
            return records, columns
    except Exception:
        # pandas 미설치 또는 DataFrame이 아닌 경우 계속 진행
        pass

    # list[dict] 형태 처리
    if isinstance(df, Iterable) and not isinstance(df, (str, bytes, dict)):
        try:
            records = list(df)  # type: ignore[var-annotated]
            if records and isinstance(records[0], Mapping):
                columns = list(records[0].keys())
                return records, columns
        except Exception:
            pass

    # to_dict(orient="records")를 지원하는 객체
    if hasattr(df, "to_dict"):
        try:
            records = df.to_dict(orient="records")  # type: ignore[attr-defined]
            columns = list(records[0].keys()) if records else None
            return records, columns
        except Exception:
            pass

    return None, None


def table_viewer(
    name: Optional[str] = None,
    *,
    data: Any = None,
    df: Any = None,
    columns: Optional[List[str]] = None,
    key: Optional[str] = None,
    default: Any = None,
):
    """테이블 뷰어 컴포넌트를 렌더링합니다.

    Parameters
    ----------
    name : Optional[str]
        헤더/타이틀로 표시할 문자열.
    data : Any
        컴포넌트로 전달할 임의의 데이터/설정 값.
    df : Any
        표로 렌더링할 데이터. 다음 타입 지원:
        - pandas.DataFrame
        - list[dict]
    columns : Optional[list[str]]
        명시적 컬럼 순서/이름. 미지정 시 df에서 추론.
    key : Optional[str]
        Streamlit 컴포넌트 key.
    default : Any
        컴포넌트가 값을 설정하기 전 기본 반환값.
    """

    records, inferred_cols = _serialize_df(df)
    if columns is None:
        columns = inferred_cols

    component_value = _component_func(
        name=name,
        data=data,
        df=records,
        columns=columns,
        key=key,
        default=default,
    )

    return component_value


if __name__ == "__main__":
    import streamlit as st

    # 데모 데이터: 현재 작성하신 data/df 자리에 연결해 사용하시면 됩니다.
    data = {
        "source": "demo",
        "note": "임의 메타데이터",
    }

    df = [
        {"EQP": "A1234", "desc": "A1234 조치 : 비상 순찰", "TS": "2024/05/19-23:59:00", "link": "http://demo1~"},
        {"EQP": "A1234", "desc": "A1234 조치 : 베어링 교체", "TS": "2024/05/18-23:59:00", "link": "http://demo2~"},
        {"EQP": "A1234", "desc": "A1234 조치 : 통신 모듈 점검", "TS": "2024/05/12-23:59:00", "link": "http://demo3~"},
        {"EQP": "B1234", "desc": "B1234 조치", "TS": "2024/05/18-23:59:00", "link": "http://demo4~"},
        {"EQP": "C1234", "desc": "C1234 조치", "TS": "2024/05/16-23:59:00", "link": "http://demo5~"},
        {"EQP": "D1234", "desc": "D1234 조치", "TS": "2024/05/14-23:59:00", "link": "http://demo6~"},
    ]

    result = table_viewer(
        name="DEMO VIEWER",
        data=data,
        df=df,
        key="demo",
        default=None,
    )

    st.write("Component returned:", result)

