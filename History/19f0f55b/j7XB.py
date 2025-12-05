import os
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


def table_viewer(name, key=None):
    component_value = _component_func(name=name, key=key, default=0)


    return component_value

if __name__ == "__main__":
    import streamlit as st
    import pandas as pd

    demo = table_viewer(name="ez_man", key="demo")


    st.write(demo)


    data = [
        {"EQP":"A1234", "desc":"A1234 조치", "TS":"2024/05/19-23:59:00"},
        ]
    
    df = pd.DataFrame(data)

    st.dataframe(df)