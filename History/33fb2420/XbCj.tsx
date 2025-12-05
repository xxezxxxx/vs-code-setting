import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactElement,
} from "react"

type Row = Record<string, unknown>

type HighlightRule = {
  terms?: string[]
  bg?: string
  columns?: string[]
}

type Args = {
  short_rows: Row[]
  detail_rows: Row[]
  left_title?: string
  right_title?: string
  height?: number
  initial_index?: number | null
  search_placeholder?: string
  accent_color?: string
  zebra?: boolean
  density?: "compact" | "comfortable"
  width?: number | string
  filter_columns?: string[]
  highlight_rules?: Record<string, HighlightRule>
}

const toStr = (v: unknown) => (v == null ? "" : String(v))

function rowToJoined(row: Row, columns?: string[]) {
  if (columns && columns.length > 0) {
    return columns.map(c => toStr(row[c])).join(" ").toLowerCase()
  }
  return Object.values(row ?? {})
    .map(v => toStr(v))
    .join(" ")
    .toLowerCase()
}

function useFilteredIndexMap(
  rows: Row[],
  query: string,
  activeFilters: Record<string, Set<string>>
): number[] {
  const q = query.trim().toLowerCase()
  return rows
    .map((r, i) => {
      const text = rowToJoined(r)
      const hitQuery = q ? text.includes(q) : true
      const hitFilters = Object.entries(activeFilters).every(([col, set]) => {
        if (set.size === 0) return true
        const val = toStr(r[col])
        return set.has(val)
      })
      return hitQuery && hitFilters ? i : -1
    })
    .filter(i => i >= 0)
}

function LevelChip({ value }: { value?: string | unknown }) {
  const val = String(value ?? "").toUpperCase()
  let bg = "#E6F0FF", fg = "#1A60D1", border = "#AFCBFF"
  if (val === "WARN" || val === "WARNING") {
    bg = "#FFF4E6"; fg = "#A76100"; border = "#FFD9A6"
  } else if (val === "ERROR" || val === "ERR" || val === "CRITICAL") {
    bg = "#FFE9E9"; fg = "#B61D1D"; border = "#FFC3C3"
  } else if (val === "INFO") {
    bg = "#E6F3FF"; fg = "#165EA8"; border = "#BBD8FF"
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        lineHeight: 1.8,
      }}
    >
      {val || "LOG"}
    </span>
  )
}

function TableView({
  rows,
  columns,
  selectedIndex,
  onSelect,
  theme,
  maxHeight,
  accent,
  zebra = true,
  density = "compact",
  getRowBg,
}: {
  rows: Row[]
  columns: string[]
  selectedIndex: number | null
  onSelect: (rowIndex: number) => void
  theme?: any
  maxHeight: number
  accent: string
  zebra?: boolean
  density?: "compact" | "comfortable"
  getRowBg?: (row: Row, ri: number) => string | undefined
}) {
  const headerBg = "#F7FAFF"
  const textColor = theme?.textColor ?? "#0f172a"
  const borderSoft = "#E6ECF7"
  const selBg = accent
  const selFg = "#fff"
  const rowPad = density === "compact" ? "9px 10px" : "12px 14px"

  return (
    <div
      style={{
        border: `1px solid ${borderSoft}`,
        borderRadius: 14,
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      }}
    >
      <div style={{ maxHeight, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    position: "sticky",
                    top: 0,
                    background: headerBg,
                    borderBottom: `1px solid ${borderSoft}`,
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 12.5,
                    letterSpacing: 0.2,
                    zIndex: 1,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 16, color: "#94a3b8", fontStyle: "italic" }}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => {
                const isSel = selectedIndex === ri
                const ruleBg = getRowBg?.(row, ri)
                const baseBg = zebra && ri % 2 === 1 ? "#FBFDFF" : "#FFFFFF"
                const bg = isSel ? selBg : (ruleBg || baseBg)
                const c = isSel ? selFg : textColor
                return (
                  <tr
                    key={ri}
                    onClick={() => onSelect(ri)}
                    style={{
                      cursor: "pointer",
                      background: bg,
                      color: c,
                      transition: "background 120ms ease, color 120ms ease",
                    }}
                    onMouseEnter={e => {
                      if (!isSel) (e.currentTarget.style.background = ruleBg || "#F2F7FF")
                    }}
                    onMouseLeave={e => {
                      if (!isSel) (e.currentTarget.style.background = ruleBg || baseBg)
                    }}
                  >
                    {columns.map(col => {
                      const val = row[col]
                      const isLevel =
                        String(col).toLowerCase() === "level" ||
                        String(col).toLowerCase() === "lvl"
                      return (
                        <td
                          key={col}
                          style={{
                            padding: rowPad,
                            borderBottom: `1px solid ${borderSoft}`,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            maxWidth: 360,
                            fontSize: 13.2,
                            verticalAlign: "middle",
                          }}
                          title={val == null ? "" : String(val)}
                        >
                          {isLevel ? <LevelChip value={val as any} /> : (val as any)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function JsonPreview({ data, accent }: { data: Row | null; accent: string }) {
  const onCopy = useCallback(() => {
    if (!data) return
    const txt = JSON.stringify(data, null, 2)
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(txt)
  }, [data])

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #E6ECF7",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(244,248,255,0.65), rgba(255,255,255,0.9))",
        boxShadow: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      }}
    >
      <button
        onClick={onCopy}
        title="Copy JSON"
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          border: `1px solid ${accent}40`,
          background: "#fff",
          color: "#0f172a",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Copy
      </button>
      <pre
        style={{
          margin: 0,
          padding: "14px 16px 16px 16px",
          fontSize: 12.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#0f172a",
        }}
      >
        {data ? JSON.stringify(data, null, 2) : "No selection"}
      </pre>
    </div>
  )
}

/** ─────────────────────────────
 *  MultiSelect Filter Popover
 *  - 버튼 클릭 → 체크박스 목록 팝오버
 *  - Select all / Clear
 *  - 외부 클릭 시 닫힘
 *  ───────────────────────────── */
function MultiSelectFilter({
  column,
  options,
  selected,
  onChange,
  accent,
  disabled,
}: {
  column: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  accent: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toggleOpen = () => !disabled && setOpen(v => !v)

  // 바깥 클릭 닫기
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const label =
    selected.size === 0
      ? column
      : `${column} (${selected.size}/${options.length})`

  const onToggleValue = (val: string) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  const onSelectAll = () => onChange(new Set(options))
  const onClear = () => onChange(new Set())

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${accent}55`,
          background: "#fff",
          fontSize: 12.5,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        title={column}
      >
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M7 10l5 5 5-5" stroke="#475569" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            width: 240,
            maxHeight: 260,
            overflow: "auto",
            background: "#fff",
            border: `1px solid ${accent}33`,
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ display: "flex", gap: 8, padding: 8 }}>
            <button
              onClick={onSelectAll}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                border: `1px solid ${accent}55`,
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Select all
            </button>
            <button
              onClick={onClear}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                border: `1px solid #e5e7eb`,
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ borderTop: "1px solid #EEF2F7" }} />
          <div style={{ padding: 8 }}>
            {options.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>No options</div>
            ) : (
              options.map(val => {
                const on = selected.has(val)
                return (
                  <label
                    key={val || "(empty)"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 6px",
                      borderRadius: 6,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggleValue(val)}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13.2 }}>
                      {val || "(empty)"}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Main */
function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  const {
    short_rows,
    detail_rows,
    left_title = "Short Log",
    right_title = "Detail",
    height = 560,
    initial_index = null,
    search_placeholder = "검색...",
    accent_color = "#4F8CF7",
    zebra = true,
    density = "compact",
    width = "100%",
    filter
