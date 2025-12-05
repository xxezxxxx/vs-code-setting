import os
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


def my_viewer(name, key=None):
    component_value = _component_func(name=name, key=key, default=0)
    return component_value


if __name__ == "__main__":

    import streamlit as st


    test = my_viewer(name="ez_man")
    st.write(test)