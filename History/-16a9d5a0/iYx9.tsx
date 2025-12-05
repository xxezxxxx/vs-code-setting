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

type HighlightNoteInput =
  | string
  | number
  | boolean
  | { title?: unknown; body?: unknown; icon?: unknown }
  | null
  | undefined

interface HighlightNoteResolved {
  title: string
  body: string
  icon: string
}

interface TableArgs {
  rows?: TableRow[]
  columns?: string[]
  caption?: string
  ui_theme?: ThemeOverrides
  ref_ts?: string | number | Date | null
  target_ts?: string | null
  highlight_note?: HighlightNoteInput
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

const normalizeEpoch = (value: number): number => {
  const absValue = Math.abs(value)
  if (absValue >= 1e9 && absValue < 1e12) {
    return value * 1000
  }
  return value
}

const toTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeEpoch(value)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) {
      return normalizeEpoch(numeric)
    }
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return null
}

const sanitizeNote = (note: unknown): string | null => {
  if (note === null || note === undefined) {
    return null
  }
  if (typeof note === "string") {
    const trimmed = note.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof note === "number" || typeof note === "boolean") {
    return String(note)
  }
  try {
    return JSON.stringify(note)
  } catch (error) {
    return String(note)
  }
}

const formatDifference = (
  targetTimestamp: number | null,
  referenceTimestamp: number | null
): string => {
  if (targetTimestamp === null || referenceTimestamp === null) {
    return "차이 정보를 계산할 수 없습니다."
  }

  const diffMs = targetTimestamp - referenceTimestamp
  const absMs = Math.abs(diffMs)

  if (absMs < 500) {
    return "0초"
  }

  const totalSeconds = Math.round(absMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}시간`)
  }
  if (minutes > 0) {
    parts.push(`${minutes}분`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}초`)
  }

  const sign = diffMs >= 0 ? "+" : "-"
  return `${sign}${parts.join(" ")}`
}

const resolveHighlightNote = (
  input: HighlightNoteInput,
  fallback: HighlightNoteResolved
): HighlightNoteResolved => {
  if (input === null || input === undefined) {
    return fallback
  }

  if (
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    const body = sanitizeNote(input)
    if (body) {
      return { ...fallback, body }
    }
    return fallback
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    const noteObject = input as {
      title?: unknown
      body?: unknown
      icon?: unknown
    }
    const icon = sanitizeNote(noteObject.icon) ?? fallback.icon
    const title = sanitizeNote(noteObject.title) ?? fallback.title
    const body = sanitizeNote(noteObject.body) ?? fallback.body
    return { icon, title, body }
  }

  return fallback
}

function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  const {
    rows: rawRows,
    columns: rawColumns,
    caption,
    ui_theme,
    ref_ts: refTimestampRaw,
    target_ts: targetTimestampColumn,
    highlight_note: highlightNoteRaw,
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

  const highlightTargetColumn = useMemo(() => {
    if (typeof targetTimestampColumn === "string") {
      const trimmed = targetTimestampColumn.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return null
  }, [targetTimestampColumn])

  const highlightReferenceTimestamp = useMemo(
    () => toTimestamp(refTimestampRaw),
    [refTimestampRaw]
  )

  const highlightMatch = useMemo(() => {
    if (
      highlightTargetColumn === null ||
      highlightReferenceTimestamp === null
    ) {
      return null
    }
    let closestIndex: number | null = null
    let closestDiff = Number.POSITIVE_INFINITY
    rows.forEach((row, index) => {
      const candidateTimestamp = toTimestamp(row[highlightTargetColumn])
      if (candidateTimestamp === null) {
        return
      }
      const diff = Math.abs(candidateTimestamp - highlightReferenceTimestamp)
      if (diff < closestDiff) {
        closestDiff = diff
        closestIndex = index
      }
    })
    if (closestIndex === null) {
      return null
    }
    return {
      rowIndex: closestIndex,
      column: highlightTargetColumn,
      diff: closestDiff,
    }
  }, [rows, highlightTargetColumn, highlightReferenceTimestamp])

  const highlightRowTimestamp = useMemo(() => {
    if (highlightMatch === null) {
      return null
    }
    const candidate = rows[highlightMatch.rowIndex]?.[highlightMatch.column]
    return toTimestamp(candidate)
  }, [rows, highlightMatch])

  const resolvedHighlightNote = useMemo(() => {
    if (highlightMatch === null || highlightReferenceTimestamp === null) {
      return null
    }

    const targetTimestamp = highlightRowTimestamp ?? highlightReferenceTimestamp
    const diffText = formatDifference(
      targetTimestamp,
      highlightReferenceTimestamp
    )
    const fallback: HighlightNoteResolved = {
      title: "<< ì´ê² ê°ì¥ ì ë ¥",
      icon: "<<",
      body: `ref_tsì ê°ì¥ ê°ê¹ì´ íìëë¤. (${diffText})`,
    }

    return resolveHighlightNote(highlightNoteRaw, fallback)
  }, [
    highlightMatch,
    highlightReferenceTimestamp,
    highlightRowTimestamp,
    highlightNoteRaw,
  ])

  const accentShadowColor = useMemo(
    () => colorWithAlpha(accentColor, 0.32, "rgba(99, 102, 241, 0.32)"),
    [accentColor]
  )
  const accentFocusColor = useMemo(
    () => colorWithAlpha(accentColor, 0.6, "rgba(99, 102, 241, 0.6)"),
    [accentColor]
  )
  const highlightBackground = useMemo(
    () => colorWithAlpha(accentColor, 0.22, "rgba(99, 102, 241, 0.22)"),
    [accentColor]
  )
  const highlightOutlineColor = useMemo(
    () => colorWithAlpha(accentColor, 0.5, "rgba(99, 102, 241, 0.5)"),
    [accentColor]
  )
  const highlightRowStyle = useMemo<React.CSSProperties>(() => {
    return {
      backgroundColor: highlightBackground,
      boxShadow: `0 10px 24px ${accentShadowColor}`,
      transform: "translateY(-1px)",
    }
  }, [highlightBackground, accentShadowColor])
  // 수정
  const tableNoteLayoutStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "flex",
      flexDirection: "row", // ✅ 가로 정렬
      flexWrap: "nowrap", // ✅ 줄바꿈 금지
      gap: "1.2rem",
      alignItems: "flex-start",
    }
  }, [])
  const tableSectionStyle = useMemo<React.CSSProperties>(() => {
    return {
      flex: "1 1 auto", // ✅ 남는 공간 다 차지
      minWidth: 0,
    }
  }, [])
  const highlightNoteCardBackground = useMemo(
    () => colorWithAlpha(accentColor, 0.12, highlightBackground),
    [accentColor, highlightBackground]
  )
  // 강조된 행의 상대 위치 계산
  const highlightNotePosition = useMemo(() => {
    if (highlightMatch === null) return null
    const rowHeight = 44 // 테이블 tr 높이 (px) – 실제 스타일에 맞게 조정
    const headerHeight = 40 // thead 높이 (px) – 실제 값 맞게 조정
    return headerHeight + highlightMatch.rowIndex * rowHeight
  }, [highlightMatch])

  // 카드 스타일 (absolute 위치)
  const highlightNoteCardStyle = useMemo<React.CSSProperties>(() => {
    return {
      position: "absolute", // ✅ 테이블 옆에 절대 위치
      left: "100%", // ✅ 테이블 오른쪽
      marginLeft: "1rem", // ✅ 간격
      top: highlightNotePosition ?? 0, // ✅ 강조 행과 맞춤
      width: "260px",
      borderRadius: 16,
      padding: "1rem 1.1rem",
      background: highlightNoteCardBackground,
      border: `1px solid ${highlightOutlineColor}`,
      boxShadow: `0 12px 28px ${accentShadowColor}`,
    }
  }, [
    highlightNoteCardBackground,
    highlightOutlineColor,
    accentShadowColor,
    highlightNotePosition,
  ])

  const highlightNoteTitleStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      fontSize: "0.85rem",
      fontWeight: 700,
      color: accentColor,
      marginBottom: "0.35rem",
    }
  }, [accentColor])
  const highlightNoteBodyStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: "0.85rem",
      lineHeight: 1.6,
      color: textColor,
      whiteSpace: "pre-wrap",
    }
  }, [textColor])

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
  const shouldShowHighlightNote = resolvedHighlightNote !== null
  const highlightNoteHeading = "ìë ë¸í¸"

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
          <div style={tableNoteLayoutStyle}>
            <div style={tableSectionStyle}>
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
                    {rows.map((row, rowIndex) => {
                      const isHighlightRow =
                        highlightMatch !== null &&
                        highlightMatch.rowIndex === rowIndex
                      const rowInlineStyle = isHighlightRow
                        ? { ...rowStyle, ...highlightRowStyle }
                        : rowStyle

                      return (
                        <tr key={rowIndex} style={rowInlineStyle}>
                          {columns.map((column) => {
                            const cellValue = row[column]
                            const content = stringifyValue(cellValue)
                            const isLinkColumn = isLikelyLinkColumn(column)
                            const isUrlContent = isUrlValue(content)
                            const renderLinkButton =
                              isLinkColumn && isUrlContent
                            const renderPlainLink =
                              !isLinkColumn && isUrlContent
                            let backgroundColor =
                              rowIndex % 2 === 0 ? zebraColor : tableBackground
                            if (isHighlightRow) {
                              backgroundColor = highlightBackground
                            }
                            const cellInlineStyle: React.CSSProperties = {
                              ...baseCellStyle,
                              backgroundColor,
                            }
                            if (isHighlightRow) {
                              cellInlineStyle.borderBottom = `1px solid ${highlightOutlineColor}`
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
                                    <span
                                      style={linkIconStyle}
                                      aria-hidden="true"
                                    >
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
                                    <span>Open</span>
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
                                  <span style={primaryTextStyle}>
                                    {content}
                                  </span>
                                ) : (
                                  content
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {shouldShowHighlightNote ? (
              <div style={highlightNoteCardStyle}>
                <div style={highlightNoteTitleStyle}>
                  <span aria-hidden="true">
                    {resolvedHighlightNote?.icon ?? "<<"}
                  </span>
                  <span>
                    {resolvedHighlightNote?.title ?? highlightNoteHeading}
                  </span>
                </div>
                <div style={highlightNoteBodyStyle}>
                  {resolvedHighlightNote?.body ??
                    "ref_ts와 가장 가까운 행입니다."}
                </div>
              </div>
            ) : null}
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
