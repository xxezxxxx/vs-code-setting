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
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(stringifyValue).join(", ")
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const colorWithAlpha = (
  color: string | undefined,
  alpha: number,
  fallback: string
): string => {
  if (!color) return fallback
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return fallback
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

const normalizeEpoch = (value: number): number => {
  const absValue = Math.abs(value)
  if (absValue >= 1e9 && absValue < 1e12) return value * 1000
  return value
}

const toTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number" && Number.isFinite(value))
    return normalizeEpoch(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) return normalizeEpoch(numeric)
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

const sanitizeNote = (note: unknown): string | null => {
  if (note === null || note === undefined) return null
  if (typeof note === "string") return note.trim() || null
  if (typeof note === "number" || typeof note === "boolean") return String(note)
  try {
    return JSON.stringify(note)
  } catch {
    return String(note)
  }
}

const formatDifference = (
  targetTimestamp: number | null,
  referenceTimestamp: number | null
): string => {
  if (targetTimestamp === null || referenceTimestamp === null)
    return "차이 정보를 계산할 수 없습니다."
  const diffMs = targetTimestamp - referenceTimestamp
  const absMs = Math.abs(diffMs)
  if (absMs < 500) return "0초"
  const totalSeconds = Math.round(absMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}시간`)
  if (minutes > 0) parts.push(`${minutes}분`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}초`)
  const sign = diffMs >= 0 ? "+" : "-"
  return `${sign}${parts.join(" ")}`
}

const resolveHighlightNote = (
  input: HighlightNoteInput,
  fallback: HighlightNoteResolved
): HighlightNoteResolved => {
  if (input === null || input === undefined) return fallback
  if (
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    const body = sanitizeNote(input)
    return body ? { ...fallback, body } : fallback
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

  const rows = useMemo<TableRow[]>(
    () =>
      Array.isArray(rawRows)
        ? rawRows.map((r) => (r && typeof r === "object" ? r : {}))
        : [],
    [rawRows]
  )
  const columns = useMemo<string[]>(() => {
    if (Array.isArray(rawColumns) && rawColumns.length > 0)
      return rawColumns.map(String)
    const collected = new Set<string>()
    rows.forEach((row) => Object.keys(row).forEach((k) => collected.add(k)))
    return Array.from(collected)
  }, [rawColumns, rows])

  const accentColor = theme?.primaryColor ?? "#6366f1"
  const textColor = theme?.textColor ?? "#1f2937"
  const borderColor = colorWithAlpha(
    theme?.textColor,
    0.16,
    "rgba(15,23,42,0.16)"
  )
  const headerBackground = colorWithAlpha(
    accentColor,
    0.12,
    "rgba(99,102,241,0.12)"
  )
  const zebraColor = colorWithAlpha(accentColor, 0.06, "rgba(99,102,241,0.06)")
  const tableBackground = theme?.backgroundColor ?? "#ffffff"
  const subtleTextColor = colorWithAlpha(textColor, 0.65, "rgba(55,65,81,0.65)")

  const highlightTargetColumn =
    typeof targetTimestampColumn === "string"
      ? targetTimestampColumn.trim() || null
      : null
  const highlightReferenceTimestamp = useMemo(
    () => toTimestamp(refTimestampRaw),
    [refTimestampRaw]
  )

  const highlightMatch = useMemo(() => {
    if (!highlightTargetColumn || highlightReferenceTimestamp === null)
      return null
    let closestIndex: number | null = null
    let closestDiff = Number.POSITIVE_INFINITY
    rows.forEach((row, index) => {
      const candidateTimestamp = toTimestamp(row[highlightTargetColumn])
      if (candidateTimestamp === null) return
      const diff = Math.abs(candidateTimestamp - highlightReferenceTimestamp)
      if (diff < closestDiff) {
        closestDiff = diff
        closestIndex = index
      }
    })
    return closestIndex !== null
      ? {
          rowIndex: closestIndex,
          column: highlightTargetColumn,
          diff: closestDiff,
        }
      : null
  }, [rows, highlightTargetColumn, highlightReferenceTimestamp])

  const highlightRowTimestamp = highlightMatch
    ? toTimestamp(rows[highlightMatch.rowIndex]?.[highlightMatch.column])
    : null
  const resolvedHighlightNote = useMemo(() => {
    if (!highlightMatch || highlightReferenceTimestamp === null) return null
    const targetTimestamp = highlightRowTimestamp ?? highlightReferenceTimestamp
    const diffText = formatDifference(
      targetTimestamp,
      highlightReferenceTimestamp
    )
    const fallback: HighlightNoteResolved = {
      title: "✨ 알림 노트",
      icon: "🔔",
      body: `ref_ts와 가장 가까운 행입니다. (${diffText})`,
    }
    return resolveHighlightNote(highlightNoteRaw, fallback)
  }, [
    highlightMatch,
    highlightReferenceTimestamp,
    highlightRowTimestamp,
    highlightNoteRaw,
  ])

  const highlightNoteTop = useMemo(() => {
    if (!highlightMatch) return 0
    const ROW_HEIGHT = 44
    const HEADER_HEIGHT = 40
    return HEADER_HEIGHT + highlightMatch.rowIndex * ROW_HEIGHT
  }, [highlightMatch])

  const highlightNoteCardStyle: React.CSSProperties = {
    position: "absolute",
    left: "100%",
    marginLeft: "1rem",
    top: highlightNoteTop,
    width: "260px",
    borderRadius: 16,
    padding: "1rem 1.1rem",
    background: colorWithAlpha(accentColor, 0.12, "#f3f4f6"),
    border: `1px solid ${colorWithAlpha(accentColor, 0.5, "#d1d5db")}`,
    boxShadow: `0 12px 28px ${colorWithAlpha(
      accentColor,
      0.32,
      "rgba(99,102,241,0.32)"
    )}`,
  }

  useEffect(() => {
    Streamlit.setFrameHeight()
  }, [rows, columns, theme, caption])

  const displayTitle = (caption ?? "").trim() || "Table"
  const rowSummary = `${rows.length.toLocaleString()} rows`
  const columnSummary = `${columns.length.toLocaleString()} columns`
  const hasData = rows.length > 0 && columns.length > 0

  return (
    <div>
      <div>{displayTitle}</div>
      <div>
        <div>
          <div>
            <div>{rowSummary}</div>
            <div>{columnSummary}</div>
          </div>
        </div>

        {hasData ? (
          <div style={{ display: "flex" }}>
            <div style={{ flex: "1 1 auto" }}>
              <div
                style={{
                  position: "relative",
                  border: `1px solid ${borderColor}`,
                }}
              >
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          style={{
                            padding: "0.75rem 1rem",
                            background: headerBackground,
                            color: accentColor,
                          }}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => {
                      const isHighlightRow =
                        highlightMatch && highlightMatch.rowIndex === rowIndex
                      return (
                        <tr
                          key={rowIndex}
                          style={{
                            background: isHighlightRow
                              ? colorWithAlpha(accentColor, 0.22, "#e0e7ff")
                              : rowIndex % 2 === 0
                              ? zebraColor
                              : tableBackground,
                          }}
                        >
                          {columns.map((column) => {
                            const content = stringifyValue(row[column])
                            return (
                              <td
                                key={`${column}-${rowIndex}`}
                                style={{
                                  padding: "0.85rem 1rem",
                                  borderBottom: `1px solid ${borderColor}`,
                                }}
                              >
                                {content}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {resolvedHighlightNote ? (
                  <div style={highlightNoteCardStyle}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: "0.35rem",
                        color: accentColor,
                      }}
                    >
                      {resolvedHighlightNote.icon} {resolvedHighlightNote.title}
                    </div>
                    <div>{resolvedHighlightNote.body}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div>No data to display.</div>
        )}
      </div>
    </div>
  )
}

export default withStreamlitConnection(MyComponent)
