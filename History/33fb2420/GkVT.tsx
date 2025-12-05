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

/** ---------------- types ---------------- */
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
  left_width?: number | string
  right_width?: number | string
  filter_columns?: string[]
  highlight_rules?: Record<string, HighlightRule>
  nav_buttons?: boolean
  nav_column?: string
  nav_terms?: { warn?: string; error?: string }
}

/** ---------------- helpers ---------------- */
const toStr = (v: unknown) => (v == null ? "" : String(v))

const rowToJoined = (row: Row, columns?: string[]) => {
  if (columns && columns.length > 0) {
    return columns
      .map((c) => toStr(row[c]))
      .join(" ")
      .toLowerCase()
  }
  return Object.values(row ?? {})
    .map((v) => toStr(v))
    .join(" ")
    .toLowerCase()
}

const useFilteredIndexMap = (
  rows: Row[],
  query: string,
  activeFilters: Record<string, Set<string>>
): number[] => {
  const q = query.trim().toLowerCase()
  return rows
    .map((r, i) => {
      const hitQuery = q ? rowToJoined(r).includes(q) : true
      const hitFilters = Object.entries(activeFilters).every(([col, set]) => {
        if (set.size === 0) return true
        return set.has(toStr(r[col]))
      })
      return hitQuery && hitFilters ? i : -1
    })
    .filter((i) => i >= 0)
}

const hexToRgba = (hex: string, alpha: number) => {
  const m = hex.replace("#", "")
  const b = parseInt(
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m,
    16
  )
  const r = (b >> 16) & 255,
    g = (b >> 8) & 255,
    bl = b & 255
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`
}
const focusRing = (accent: string, size = 4) =>
  `0 0 0 ${size}px ${hexToRgba(accent, 0.12)}`

/** ---------------- small UI parts ---------------- */
function LevelChip({ value }: { value?: string | unknown }) {
  const val = String(value ?? "").toUpperCase()
  let bg = "#EAF2FF",
    fg = "#1E60D1",
    br = "#CFE0FF"
  if (val === "WARNING" || val === "WARN") {
    bg = "#FFF5D8"
    fg = "#8A5A00"
    br = "#FFE4A6"
  } else if (val === "ERROR" || val === "ERR" || val === "CRITICAL") {
    bg = "#FFEAEA"
    fg = "#B81F1F"
    br = "#FFC7C7"
  } else if (val === "DEBUG") {
    bg = "#F2F6FA"
    fg = "#4B5563"
    br = "#E5E7EB"
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
        border: `1px solid ${br}`,
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
  maxHeight,
  zebra = true,
  density = "compact",
  accent,
  getRowBg,
}: {
  rows: Row[]
  columns: string[]
  selectedIndex: number | null
  onSelect: (rowIndex: number) => void
  maxHeight: number
  zebra?: boolean
  density?: "compact" | "comfortable"
  accent: string
  getRowBg?: (row: Row, ri: number) => string | undefined
}) {
  const borderSoft = "#E7EAF0"
  const selBg = accent,
    selFg = "#fff"
  const rowPad = density === "compact" ? "9px 10px" : "12px 14px"

  return (
    <div
      style={{
        border: `1px solid ${borderSoft}`,
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ maxHeight, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr style={{ background: "#F7F9FC" }}>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    position: "sticky",
                    top: 0,
                    borderBottom: `1px solid ${borderSoft}`,
                    color: "#111827",
                    fontWeight: 700,
                    fontSize: 12.5,
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
                <td
                  colSpan={columns.length}
                  style={{ padding: 16, color: "#9CA3AF", fontStyle: "italic" }}
                >
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => {
                const isSel = selectedIndex === ri
                const ruleBg = getRowBg?.(row, ri)
                const baseBg = zebra && ri % 2 === 1 ? "#FAFBFF" : "#FFFFFF"
                const bg = isSel ? selBg : ruleBg || baseBg
                const c = isSel ? selFg : "#111827"
                return (
                  <tr
                    key={ri}
                    onClick={() => onSelect(ri)}
                    style={{
                      cursor: "pointer",
                      background: bg,
                      color: c,
                      transition: "background 140ms ease",
                      outline: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = ruleBg || "#F2F6FF"
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = ruleBg || baseBg
                    }}
                    onFocus={(e) => {
                      ;(e.currentTarget as HTMLElement).style.boxShadow =
                        focusRing(accent, 3)
                    }}
                    onBlur={(e) => {
                      ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                    }}
                    tabIndex={0}
                  >
                    {columns.map((col) => {
                      const val = row[col]
                      const isLevel = [
                        "level",
                        "lvl",
                        "Level",
                        "LEVEL",
                      ].includes(String(col))
                      return (
                        <td
                          key={col}
                          style={{
                            padding: rowPad,
                            borderBottom: `1px solid ${borderSoft}`,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            maxWidth: 420,
                            fontSize: 13.2,
                            verticalAlign: "middle",
                          }}
                          title={val == null ? "" : String(val)}
                        >
                          {isLevel ? (
                            <LevelChip value={val as any} />
                          ) : (
                            (val as any)
                          )}
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

function JsonPreview({
  data,
  accent,
  maxHeight,
}: {
  data: Row | null
  accent: string
  maxHeight?: number
}) {
  const [pressed, setPressed] = useState(false)
  const [toast, setToast] = useState(false)
  const onCopy = useCallback(() => {
    if (!data) return
    const txt = JSON.stringify(data, null, 2)
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(txt)
        .then(() => {
          setToast(true)
          setTimeout(() => setToast(false), 1400)
        })
        .catch(() => {})
    }
  }, [data])

  return (
    <div
      style={{
        border: "1px solid #E7EAF0",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        position: "relative",
        maxHeight: maxHeight,
        overflow: maxHeight ? "auto" : "visible",
      }}
    >
      <style>
        {`
        @keyframes toastFadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          25% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        `}
      </style>
      <button
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        onClick={onCopy}
        title="Copy JSON"
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          border: `1px solid ${pressed ? accent : "#E7EAF0"}`,
          background: "#fff",
          color: "#111827",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
          boxShadow: pressed ? focusRing(accent, 3) : "none",
          outline: "none",
        }}
      >
        Copy
      </button>
      {toast && (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: 48,
            background: "#4F8CF7",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12.5,
            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
            animation: "toastFadeUp 1.2s ease forwards",
            pointerEvents: "none",
          }}
        >
          Copied !
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: "14px 16px 16px 16px",
          fontSize: 12.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          color: "#111827",
        }}
      >
        {data ? JSON.stringify(data, null, 2) : "No selection"}
      </pre>
    </div>
  )
}

/** --------------- MultiSelect Popover ---------------
 * - 버튼/포커스/클릭 시 Search와 동일한 파란 포커스/보더
 * - 팝오버 열리면 스크롤/드래그바 없이 전 옵션을 모두 노출 (overflow: visible)
 * --------------------------------------------------- */
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
  const [q, setQ] = useState("")
  const [pressed, setPressed] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toggle = () => !disabled && setOpen((v) => !v)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false)
    }
    if (open) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((v) => (v || "").toLowerCase().includes(needle))
  }, [q, options])

  const label =
    selected.size === 0
      ? `Filter: ${column}`
      : `Filter: ${column} (${selected.size}/${options.length})`
  const onToggleValue = (val: string) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }
  const onAll = () => onChange(new Set(options))
  const onClear = () => onChange(new Set())

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${open || pressed ? accent : "#E7EAF0"}`,
          background: "#fff",
          fontSize: 12.5,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#111827",
          fontWeight: open ? 600 : 500,
          boxShadow: open || pressed ? focusRing(accent, 3) : "none",
          outline: "none",
        }}
        title={column}
      >
        {/* filter icon inside button */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6h18M6 12h12M10 18h4"
            stroke={open ? accent : "#4B5563"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 10l5 5 5-5"
            stroke={open ? accent : "#4B5563"}
            strokeWidth="2"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            /** 스크롤/드래그바 없이 전체 표시 */
            width: "max-content",
            maxWidth: 360,
            background: "#fff",
            border: `1px solid #E7EAF0`,
            borderRadius: 10,
            boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 8,
              alignItems: "center",
            }}
          >
            <input
              placeholder="Filter options…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid #E7EAF0`,
                outline: "none",
                fontSize: 12.5,
                flex: 1,
                boxShadow: "none",
              }}
            />
            <button
              onClick={onAll}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid #E7EAF0`,
                background: "#fff",
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: "none",
                outline: "none",
              }}
              onMouseDown={(e) => {
                ;(
                  e.currentTarget as HTMLElement
                ).style.border = `1px solid ${accent}`
                ;(e.currentTarget as HTMLElement).style.boxShadow = focusRing(
                  accent,
                  2
                )
              }}
              onMouseUp={(e) => {
                ;(
                  e.currentTarget as HTMLElement
                ).style.border = `1px solid #E7EAF0`
                ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
              }}
            >
              All
            </button>
            <button
              onClick={onClear}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid #E7EAF0`,
                background: "#fff",
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: "none",
                outline: "none",
              }}
              onMouseDown={(e) => {
                ;(
                  e.currentTarget as HTMLElement
                ).style.border = `1px solid ${accent}`
                ;(e.currentTarget as HTMLElement).style.boxShadow = focusRing(
                  accent,
                  2
                )
              }}
              onMouseUp={(e) => {
                ;(
                  e.currentTarget as HTMLElement
                ).style.border = `1px solid #E7EAF0`
                ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ borderTop: "1px solid #EEF2F7" }} />

          {/* 옵션 전체 노출 영역 (overflow: visible, no scrollbar) */}
          <div style={{ padding: 8, overflow: "visible" }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>No options</div>
            ) : (
              filtered.map((val) => {
                const on = selected.has(val)
                return (
                  <label
                    key={val || "(empty)"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 6px",
                      borderRadius: 8,
                      cursor: "pointer",
                      userSelect: "none",
                      border: `1px solid ${on ? accent : "#F3F4F6"}`,
                      boxShadow: on ? focusRing(accent, 2) : "none",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggleValue(val)}
                      style={{
                        cursor: "pointer",
                        accentColor: accent,
                        width: 14,
                        height: 14,
                      }}
                    />
                    <span style={{ fontSize: 13.2 }}>{val || "(empty)"}</span>
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

/** ---------------- main (accent everywhere + no-scroll filter popover) ---------------- */
function MyComponent({ args, disabled }: ComponentProps): ReactElement {
  const {
    short_rows,
    detail_rows,
    left_title = "Simple Log",
    right_title = "Detail Log",
    height = 560,
    initial_index = null,
    search_placeholder = "Search",
    accent_color = "#4F8CF7",
    zebra = true,
    density = "compact",
    width = "100%",
    left_width = 1.15,
    right_width = 1,
    filter_columns = [],
    highlight_rules = {},
    nav_buttons = false,
    nav_column = "Level",
    nav_terms = { warn: "WARN", error: "ERROR" },
  } = args as Args

  const [query, setQuery] = useState<string>("")
  const [isSearchFocus, setSearchFocus] = useState(false)
  const [activeFilters, setActiveFilters] = useState<
    Record<string, Set<string>>
  >(() =>
    Object.fromEntries(
      (filter_columns || []).map((c) => [c, new Set<string>()])
    )
  )

  const filterOptions = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, Set<string>> = {}
    for (const col of filter_columns || []) map[col] = new Set<string>()
    ;(short_rows || []).forEach((r) => {
      for (const col of filter_columns || []) map[col].add(toStr(r[col]))
    })
    return Object.fromEntries(
      Object.entries(map).map(([col, set]) => [col, Array.from(set).sort()])
    )
  }, [short_rows, filter_columns])

  const filteredIndexMap = useFilteredIndexMap(
    short_rows ?? [],
    query,
    activeFilters
  )
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<
    number | null
  >(initial_index ?? null)

  useEffect(() => {
    if (
      selectedOriginalIndex !== null &&
      !filteredIndexMap.includes(selectedOriginalIndex)
    ) {
      setSelectedOriginalIndex(null)
    }
  }, [query, filteredIndexMap, selectedOriginalIndex])

  const pushValue = useCallback(
    (idx: number | null, q: string) => {
      const activeFiltersObj = Object.fromEntries(
        Object.entries(activeFilters).map(([k, v]) => [k, Array.from(v)])
      )
      Streamlit.setComponentValue({
        selected_index: idx,
        selected_short: idx !== null ? short_rows[idx] ?? null : null,
        selected_detail: idx !== null ? detail_rows[idx] ?? null : null,
        query: q,
        active_filters: activeFiltersObj,
      })
    },
    [short_rows, detail_rows, activeFilters]
  )

  useEffect(() => {
    pushValue(selectedOriginalIndex, query)
  }, [selectedOriginalIndex, query, pushValue, activeFilters])
  useEffect(() => {
    Streamlit.setFrameHeight(height + 120)
  }, [height, query, selectedOriginalIndex, activeFilters])

  const columns = useMemo<string[]>(() => {
    if (!short_rows || short_rows.length === 0) return []
    const keys = new Set<string>()
    short_rows.forEach((r) => Object.keys(r ?? {}).forEach((k) => keys.add(k)))
    return Array.from(keys)
  }, [short_rows])

  const visibleShortRows = useMemo<Row[]>(
    () => filteredIndexMap.map((i) => short_rows[i]),
    [filteredIndexMap, short_rows]
  )
  const selectedVisibleIndex =
    selectedOriginalIndex === null
      ? null
      : visibleShortRows.findIndex(
          (_, vIdx) => filteredIndexMap[vIdx] === selectedOriginalIndex
        )

  // Navigate to next row matching term within the visible (filtered) set.
  const lastPosRef = useRef<Record<string, number>>({})
  const goToNext = useCallback(
    (spec: { columns: string[]; terms: string[]; key: string }) => {
      const cols = (spec.columns || []).filter(Boolean)
      const terms = (spec.terms || [])
        .map((s) => (s || "").toLowerCase())
        .filter(Boolean)
      if (cols.length === 0 || terms.length === 0) return
      const hits: number[] = []
      visibleShortRows.forEach((row, vIdx) => {
        const match = cols.some((c) => {
          const val = toStr(row?.[c]).toLowerCase()
          return terms.some((t) => val.includes(t))
        })
        if (match) hits.push(vIdx)
      })
      if (hits.length === 0) return
      const last = lastPosRef.current[spec.key] ?? -1
      const startFrom = selectedVisibleIndex ?? -1
      const next = hits.find((v) => v > Math.max(last, startFrom)) ?? hits[0]
      lastPosRef.current[spec.key] = next
      setSelectedOriginalIndex(filteredIndexMap[next])
    },
    [visibleShortRows, filteredIndexMap, selectedVisibleIndex]
  )

  const widthStyle: React.CSSProperties =
    typeof width === "number"
      ? { width: `${width}px` }
      : { width: width || "100%" }

  // Make left table and right detail areas visually align in height
  const bodyHeight = Math.max(200, height - 140)
  const [pressedBtn, setPressedBtn] = useState<string | null>(null)

  const getRowBg = useCallback(
    (row: Row): string | undefined => {
      const rules = Object.values(highlight_rules || {})
      if (rules.length === 0) return undefined
      const allText = rowToJoined(row)
      for (const rule of rules) {
        const terms = rule.terms || []
        if (terms.length === 0) continue
        const text =
          rule.columns && rule.columns.length > 0
            ? rowToJoined(row, rule.columns)
            : allText
        if (terms.some((t) => text.includes(String(t).toLowerCase())))
          return rule.bg || "rgba(79,140,247,0.10)"
      }
      return undefined
    },
    [highlight_rules]
  )

  const toolbar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
  }

  return (
    <div style={{ ...widthStyle }}>
      {/* Toolbar only for Simple Log (left column), aligned right, above titles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${toCol(left_width, "1.15fr")} ${toCol(
            right_width,
            "1fr"
          )}`,
          alignItems: "center",
          columnGap: 16,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {Object.keys(filterOptions).length > 0 && (
            <div
              style={{
                ...toolbar,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {Object.entries(filterOptions).map(([col, opts]) => (
                <MultiSelectFilter
                  key={col}
                  column={col}
                  options={opts}
                  selected={activeFilters[col] ?? new Set<string>()}
                  onChange={(next) =>
                    setActiveFilters((prev) => ({ ...prev, [col]: next }))
                  }
                  accent={accent_color}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
          <div style={{ position: "relative", width: "fit-content" }}>
            <input
              disabled={disabled}
              placeholder={search_placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              style={{
                padding: "10px 40px 10px 40px",
                borderRadius: 999,
                border: `1px solid ${
                  isSearchFocus ? args.accent_color || "#4F8CF7" : "#E7EAF0"
                }`,
                outline: "none",
                fontSize: 13.5,
                width: isSearchFocus ? 260 : 180,
                transition:
                  "width 180ms ease, border 160ms ease, box-shadow 160ms ease",
                background: "#fff",
                boxShadow: isSearchFocus
                  ? focusRing(args.accent_color || "#4F8CF7", 4)
                  : "inset 0 1px 2px rgba(0,0,0,0.04)",
              }}
            />
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              style={{ position: "absolute", left: 12, top: 11 }}
            >
              <path
                d="M11 4a7 7 0 015.292 11.708l3 3a1 1 0 01-1.414 1.414l-3-3A7 7 0 1111 4z"
                stroke={args.accent_color || "#4F8CF7"}
                strokeWidth="1.6"
              />
            </svg>
          </div>
          {/* removed nav buttons from search/filter row */}
        </div>
        <div />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${toCol(left_width, "1.15fr")} ${toCol(
            right_width,
            "1fr"
          )}`,
          alignItems: "center",
          columnGap: 16,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>{left_title}</div>
          <div style={{ display: "inline-flex", gap: 8 }}>
            {(() => {
              const items: React.ReactNode[] = []
              if ((args as any).buttons) {
                const btns = (args as any).buttons as Record<
                  string,
                  Record<string, string[]>
                >
                for (const label of Object.keys(btns)) {
                  const map = btns[label] || {}
                  const columns = Object.keys(map)
                  const terms = columns.flatMap((c) => map[c] || [])
                  items.push(
                    <button
                      key={label}
                      type="button"
                      onClick={() => goToNext({ columns, terms, key: label })}
                      onMouseDown={() => setPressedBtn && setPressedBtn(label)}
                      onMouseUp={() => setPressedBtn && setPressedBtn(null)}
                      onBlur={() => setPressedBtn && setPressedBtn(null)}
                      disabled={disabled}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${
                          pressedBtn === label
                            ? args.accent_color || "#4F8CF7"
                            : "#E7EAF0"
                        }`,
                        background: "#fff",
                        fontSize: 12.5,
                        cursor: "pointer",
                        outline: "none",
                        boxShadow:
                          pressedBtn === label
                            ? focusRing(args.accent_color || "#4F8CF7", 3)
                            : "none",
                      }}
                      title={label}
                    >
                      {label}
                    </button>
                  )
                }
              } else if (nav_buttons) {
                items.push(
                  <button
                    key="__go_error"
                    type="button"
                    onClick={() =>
                      goToNext({
                        columns: [nav_column],
                        terms: [nav_terms?.error || "ERROR"],
                        key: "__error",
                      })
                    }
                    disabled={disabled}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid #E7EAF0`,
                      background: "#fff",
                      fontSize: 12.5,
                      cursor: "pointer",
                      outline: "none",
                    }}
                    title={`Go next ${nav_terms?.error || "ERROR"}`}
                  >
                    Go Error
                  </button>
                )
                items.push(
                  <button
                    key="__go_warn"
                    type="button"
                    onClick={() =>
                      goToNext({
                        columns: [nav_column],
                        terms: [nav_terms?.warn || "WARN"],
                        key: "__warn",
                      })
                    }
                    disabled={disabled}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid #E7EAF0`,
                      background: "#fff",
                      fontSize: 12.5,
                      cursor: "pointer",
                      outline: "none",
                    }}
                    title={`Go next ${nav_terms?.warn || "WARN"}`}
                  >
                    Go Warn
                  </button>
                )
              }
              return items
            })()}
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{right_title}</div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${toCol(left_width, "1.15fr")} ${toCol(
            right_width,
            "1fr"
          )}`,
          gap: 16,
          alignItems: "stretch",
          color: "#111827",
        }}
      >
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TableView
            rows={visibleShortRows}
            columns={columns}
            selectedIndex={selectedVisibleIndex}
            onSelect={(vIdx: number) =>
              setSelectedOriginalIndex(filteredIndexMap[vIdx])
            }
            maxHeight={bodyHeight}
            zebra={zebra}
            density={density}
            accent={args.accent_color || "#4F8CF7"}
            getRowBg={getRowBg}
          />
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <JsonPreview
            data={
              selectedOriginalIndex !== null
                ? detail_rows[selectedOriginalIndex]
                : null
            }
            accent={args.accent_color || "#4F8CF7"}
            maxHeight={bodyHeight}
          />
        </div>
      </div>
    </div>
  )
}
const toCol = (v: number | string | undefined, fallback: string): string => {
  if (v == null) return fallback
  if (typeof v === "number") return `${v}fr`
  return v
}

export default withStreamlitConnection(MyComponent)
