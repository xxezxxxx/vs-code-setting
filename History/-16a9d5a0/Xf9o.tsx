import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import React, { useEffect, useMemo, ReactElement } from "react"

type TableRow = Record<string, unknown>

interface ThemeOverrides {
  accentColor?: string
  borderColor?: string
  headerBackground?: string
  zebraColor?: string
  cardBackground?: string
  tableBackground?: string
  textColor?: string
  subtleTextColor?: string
}

interface TableArgs {
  rows?: TableRow[]
  columns?: string[]
  caption?: string
  ui_theme?: ThemeOverrides
}

const LINK_BUTTON_CLASS = "table-viewer-link-button"

const isLikelyLinkColumn = (column: string): boolean => {
  const lower = column.toLowerCase()
  return lower.includes("link") || lower.includes("url")
}

const isUrlValue = (value: unknown): value is string => {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(", ")
  }
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

const colorWithAlpha = (
  color: string | undefined,
  alpha: number,
  fallback: string
): string => {
  if (!color) {
    return fallback
  }

  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) {
    return fallback
  }

  let hex = match[1]
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("")
  }

  const intVal = parseInt(hex, 16)
  const r = (intVal >> 16) & 255
  const g = (intVal >> 8) & 255
  const b = intVal & 255

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const normalizeThemeOverrides = (overrides: unknown): ThemeOverrides => {
  if (!overrides || typeof overrides !== "object") {
    return {}
  }

  const result: ThemeOverrides = {}
  ;[
    "accentColor",
    "borderColor",
    "headerBackground",
    "zebraColor",
    "cardBackground",
    "tableBackground",
    "textColor",
    "subtleTextColor",
  ].forEach((key) => {
    const value = (overrides as Record<string, unknown>)[key]
    if (typeof value === "string" && value.trim().length > 0) {
      result[key as keyof ThemeOverrides] = value.trim()
    }
  })

  return result
}

function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  const {
    rows: rawRows,
    columns: rawColumns,
    caption,
    ui_theme,
  } = (args as TableArgs) || {}

  const rows = useMemo<TableRow[]>(() => {
    if (Array.isArray(rawRows)) {
      return rawRows.map((row) => (row && typeof row === "object" ? row : {}))
    }
    return []
  }, [rawRows])

  const columns = useMemo<string[]>(() => {
    if (Array.isArray(rawColumns) && rawColumns.length > 0) {
      return rawColumns.map((column) => String(column))
    }

    const collected = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => collected.add(key))
    })
    return Array.from(collected)
  }, [rawColumns, rows])

  const overrides = useMemo(() => normalizeThemeOverrides(ui_theme), [ui_theme])

  const accentColor = useMemo(
    () => overrides.accentColor ?? theme?.primaryColor ?? "#6366f1",
    [overrides.accentColor, theme]
  )
  const textColor = useMemo(
    () => overrides.textColor ?? theme?.textColor ?? "#1f2937",
    [overrides.textColor, theme]
  )
  const borderColor = useMemo(
    () =>
      overrides.borderColor ??
      colorWithAlpha(theme?.textColor, 0.16, "rgba(15, 23, 42, 0.16)"),
    [overrides.borderColor, theme]
  )
  const headerBackground = useMemo(
    () =>
      overrides.headerBackground ??
      colorWithAlpha(accentColor, 0.12, "rgba(99, 102, 241, 0.12)"),
    [overrides.headerBackground, accentColor]
  )
  const zebraColor = useMemo(
    () =>
      overrides.zebraColor ??
      colorWithAlpha(accentColor, 0.06, "rgba(99, 102, 241, 0.06)"),
    [overrides.zebraColor, accentColor]
  )
  const containerBackground = useMemo(
    () =>
      overrides.cardBackground ?? theme?.secondaryBackgroundColor ?? "#ffffff",
    [overrides.cardBackground, theme]
  )
  const tableBackground = useMemo(
    () => overrides.tableBackground ?? theme?.backgroundColor ?? "#ffffff",
    [overrides.tableBackground, theme]
  )
  const subtleTextColor = useMemo(
    () =>
      overrides.subtleTextColor ??
      colorWithAlpha(textColor, 0.65, "rgba(55, 65, 81, 0.65)"),
    [overrides.subtleTextColor, textColor]
  )
  const accentShadowColor = useMemo(
    () => colorWithAlpha(accentColor, 0.32, "rgba(99, 102, 241, 0.32)"),
    [accentColor]
  )
  const accentFocusColor = useMemo(
    () => colorWithAlpha(accentColor, 0.6, "rgba(99, 102, 241, 0.6)"),
    [accentColor]
  )

  const rootStyle = useMemo<React.CSSProperties>(() => {
    return {
      opacity: disabled ? 0.6 : 1,
      pointerEvents: disabled ? "none" : "auto",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }
  }, [disabled])

  const titleStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: "1.05rem",
      fontWeight: 700,
      color: textColor,
      letterSpacing: "0.01em",
    }
  }, [textColor])

  const containerStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      background: containerBackground,
      borderRadius: 16,
      border: `1px solid ${borderColor}`,
      padding: "1rem 1.25rem 1.25rem",
      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.1)",
      transition: "transform 160ms ease, box-shadow 160ms ease",
    }
  }, [containerBackground, borderColor])

  const headerContainerStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      background: headerBackground,
      borderRadius: 12,
      padding: "0.7rem 1rem",
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4)",
    }
  }, [headerBackground])

  const headerTextBlockStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "flex",
      flexDirection: "column",
      gap: "0.2rem",
    }
  }, [])

  const headerTextStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: "0.84rem",
      fontWeight: 600,
      color: textColor,
      letterSpacing: "0.01em",
    }
  }, [textColor])

  const headerMetaStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: "0.74rem",
      color: subtleTextColor,
    }
  }, [subtleTextColor])

  const optionsPlaceholderStyle = useMemo<React.CSSProperties>(() => {
    return {
      minHeight: "1.75rem",
      minWidth: "3.5rem",
      borderRadius: 999,
      visibility: "hidden",
    }
  }, [])

  const tableWrapperStyle = useMemo<React.CSSProperties>(() => {
    return {
      overflowX: "auto",
      borderRadius: 14,
      border: `1px solid ${borderColor}`,
      background: tableBackground,
      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
    }
  }, [borderColor, tableBackground])

  const tableStyle = useMemo<React.CSSProperties>(() => {
    return {
      borderCollapse: "collapse",
      width: "100%",
      fontFamily: theme?.font ?? "inherit",
    }
  }, [theme])

  const headerStyle = useMemo<React.CSSProperties>(() => {
    return {
      textAlign: "left",
      padding: "0.75rem 1rem",
      backgroundColor: headerBackground,
      color: accentColor,
      textTransform: "uppercase" as const,
      fontSize: "0.72rem",
      letterSpacing: "0.08em",
      borderBottom: `1px solid ${borderColor}`,
      position: "sticky" as const,
      top: 0,
      zIndex: 2,
    }
  }, [headerBackground, accentColor, borderColor])

  const baseCellStyle = useMemo<React.CSSProperties>(() => {
    return {
      padding: "0.85rem 1rem",
      borderBottom: `1px solid ${borderColor}`,
      color: textColor,
      fontSize: "0.9rem",
      lineHeight: 1.5,
      transition: "background-color 160ms ease",
    }
  }, [borderColor, textColor])

  const linkButtonStyle = useMemo<React.CSSProperties>(() => {
    return {
      background: accentColor,
      color: "#ffffff",
      borderRadius: 999,
      padding: "0.35rem 0.85rem 0.4rem",
      border: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      fontSize: "0.78rem",
      fontWeight: 600,
      textDecoration: "none",
      boxShadow: `0 6px 14px ${accentShadowColor}`,
      transition: "transform 160ms ease, box-shadow 160ms ease",
    }
  }, [accentColor, accentShadowColor])

  const linkIconStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "rgba(255, 255, 255, 0.22)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ffffff",
    }
  }, [])

  const primaryTextStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontWeight: 600,
      color: textColor,
    }
  }, [textColor])

  const rowStyle = useMemo<React.CSSProperties>(() => {
    return {
      transition: "background-color 160ms ease, transform 160ms ease",
    }
  }, [])

  const emptyStateStyle = useMemo<React.CSSProperties>(() => {
    return {
      padding: "1.2rem",
      textAlign: "center" as const,
      color: subtleTextColor,
      fontSize: "0.9rem",
    }
  }, [subtleTextColor])

  const linkButtonStylesheet = useMemo(() => {
    return `.${LINK_BUTTON_CLASS}:hover { transform: translateY(-1px); box-shadow: 0 10px 24px ${accentShadowColor}; }
.${LINK_BUTTON_CLASS}:focus-visible { outline: 2px solid ${accentFocusColor}; outline-offset: 2px; }`
  }, [accentFocusColor, accentShadowColor])

  useEffect(() => {
    Streamlit.setFrameHeight()
  }, [rows, columns, theme, caption, overrides])

  const displayTitle = (caption ?? "").trim() || "Table"
  const rowSummary = `${rows.length.toLocaleString()} rows`
  const columnSummary = `${columns.length.toLocaleString()} columns`
  const hasData = rows.length > 0 && columns.length > 0

  return (
    <div style={rootStyle}>
      <div style={titleStyle}>{displayTitle}</div>

      <div style={containerStyle}>
        <div style={headerContainerStyle}>
          <div style={headerTextBlockStyle}>
            <div style={headerTextStyle}>{rowSummary}</div>
            <div style={headerMetaStyle}>{columnSummary}</div>
          </div>
          <div style={optionsPlaceholderStyle} aria-hidden="true" />
        </div>

        {hasData ? (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} style={headerStyle}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={rowStyle}>
                    {columns.map((column) => {
                      const cellValue = row[column]
                      const content = stringifyValue(cellValue)
                      const isLinkColumn = isLikelyLinkColumn(column)
                      const isUrlContent = isUrlValue(content)
                      const renderLinkButton = isLinkColumn && isUrlContent
                      const renderPlainLink = !isLinkColumn && isUrlContent
                      const backgroundColor =
                        rowIndex % 2 === 0 ? zebraColor : tableBackground
                      const cellInlineStyle = {
                        ...baseCellStyle,
                        backgroundColor,
                      }
                      const isFirstColumn = column === columns[0]

                      return (
                        <td
                          key={`${column}-${rowIndex}`}
                          style={cellInlineStyle}
                        >
                          {renderLinkButton ? (
                            <a
                              className={LINK_BUTTON_CLASS}
                              style={linkButtonStyle}
                              href={content}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open link"
                            >
                              <span style={linkIconStyle} aria-hidden="true">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M3 9L9 3M5 3H9V7"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            </a>
                          ) : renderPlainLink ? (
                            <a
                              href={content}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: accentColor,
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              {content}
                            </a>
                          ) : isFirstColumn ? (
                            <span style={primaryTextStyle}>{content}</span>
                          ) : (
                            content
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={emptyStateStyle}>No data to display.</div>
        )}
      </div>
      <style>{linkButtonStylesheet}</style>
    </div>
  )
}

export default withStreamlitConnection(MyComponent)
