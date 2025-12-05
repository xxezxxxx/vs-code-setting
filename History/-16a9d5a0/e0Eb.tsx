import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  ReactElement,
} from "react"

/**
 * A template for creating Streamlit components with React
 *
 * This component demonstrates the essential structure and patterns for
 * creating interactive Streamlit components, including:
 * - Accessing props and args sent from Python
 * - Managing component state with React hooks
 * - Communicating back to Streamlit via Streamlit.setComponentValue()
 * - Using the Streamlit theme for styling
 * - Setting frame height for proper rendering
 *
 * @param {ComponentProps} props - The props object passed from Streamlit
 * @param {Object} props.args - Custom arguments passed from the Python side
 * @param {string} props.args.name - Example argument showing how to access Python-defined values
 * @param {boolean} props.disabled - Whether the component is in a disabled state
 * @param {Object} props.theme - Streamlit theme object for consistent styling
 * @returns {ReactElement} The rendered component
 */
function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  // Extract custom arguments passed from Python
  const { name } = args

  // Component state
  const [isFocused, setIsFocused] = useState(false)
  const [numClicks, setNumClicks] = useState(0)

  /**
   * Dynamic styling based on Streamlit theme and component state
   * This demonstrates how to use the Streamlit theme for consistent styling
   */
  const style: React.CSSProperties = useMemo(() => {
    if (!theme) return {}

    // Use the theme object to style the button border
    // Access theme properties like primaryColor, backgroundColor, etc.
    const borderStyling = `1px solid ${isFocused ? theme.primaryColor : "gray"}`
    return { border: borderStyling, outline: borderStyling }
  }, [theme, isFocused])

  /**
   * Tell Streamlit the height of this component
   * This ensures the component fits properly in the Streamlit app
   */
  useEffect(() => {
    // Call this when the component's size might change
    Streamlit.setFrameHeight()
    // Adding the style and theme as dependencies since they might
    // affect the visual size of the component.
  }, [style, theme])

  /**
   * Click handler for the button
   * Demonstrates how to update component state and send data back to Streamlit
   */
  const onClicked = useCallback((): void => {
    const newNumClicks = numClicks + 1

    setNumClicks(newNumClicks)

    Streamlit.setComponentValue(newNumClicks)
  }, [numClicks])


  const onFocus = useCallback((): void => {
    setIsFocused(true)
  }, [])


  const onBlur = useCallback((): void => {
    setIsFocused(false)
  }, [])

  return (
    <span>
      Hello, {name}! &nbsp;
      <button
        style={style}
        onClick={onClicked}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        Click Me!
      </button>
    </span>
  )
}


export default withStreamlitConnection(MyComponent)
