import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { createStyles } from "../styles"
import { IconCaretMini, IconClose, IconError, IconFilter, IconInfo, IconSearch, IconWarn } from "../icons"
import { stringifyDetail, stringifyRow } from "../utils"
import type {
  AlarmNote,
  AlarmNoteProp,
  FilterConfig,
  SearchConfig,
  ShortLogJumpButtons,
  ShortLogLayout,
  StyleRule,
  TableData,
} from "../types"

type Props = {
  data?: TableData
  filterConfig?: FilterConfig
  searchConfig?: SearchConfig
  onSelect: (row: any, index: number) => void
  accent: string
  loading?: boolean
  showHeader?: boolean
  styleRules?: StyleRule[]
  listMaxHeight?: number | null
  listMinHeight?: number | null
  layout?: ShortLogLayout | null
  jumpButtons?: ShortLogJumpButtons | null
  detailData?: TableData
  alarmNote?: AlarmNoteProp
}

export default function ShortLogView(props: Props) {
  const {
    data,
    filterConfig,
    searchConfig,
    onSelect,
    accent,
    loading,
    showHeader = true,
    styleRules,
    listMaxHeight,
    listMinHeight,
    layout,
    jumpButtons,
    detailData,
    alarmNote,
  } = props
  
  const s = createStyles(accent)

  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  rowRefs.current = [] 

  
  const rows = data?.records || []
  const columns = data?.columns || []
  const detailRows = detailData?.records || []
  const detailColumns = detailData?.columns

  const [active, setActive] = useState<number | null>(null)
  const [query, setQuery] = useState<string>(searchConfig?.initial || "")
  const [activeJump, setActiveJump] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string | string[]>>(
    () => ({ ...(filterConfig?.initial || {}) })
  )
  const [searchFocused, setSearchFocused] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterWrapRef = useRef<HTMLDivElement | null>(null)
  const jumpFlashTimerRef = useRef<number | null>(null)
  const [clearPressed, setClearPressed] = useState(false)
  const [donePressed, setDonePressed] = useState(false)
  const [closePressed, setClosePressed] = useState(false)
  const [openJumpMenu, setOpenJumpMenu] = useState<string | null>(null)
  const [viewAllLabel, setViewAllLabel] = useState<string | null>(null)
  const jumpRowRef = useRef<HTMLDivElement | null>(null)

  const centerNextRef = useRef(false)   

  

  useEffect(() => {
    if (!filterOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = filterWrapRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown, true)
    return () => document.removeEventListener("mousedown", onDocMouseDown, true)
  }, [filterOpen])

  // cleanup any pending highlight timer
  useEffect(() => {
    return () => {
      if (jumpFlashTimerRef.current != null) {
        window.clearTimeout(jumpFlashTimerRef.current)
        jumpFlashTimerRef.current = null
      }
    }
  }, [])

  

  // Close jump split menus on outside click (use 'click' to avoid interfering with button onClick)
  useEffect(() => {
    if (!openJumpMenu) return
    const onDocClick = (e: MouseEvent) => {
      const el = jumpRowRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setOpenJumpMenu(null)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [openJumpMenu])
  

  const searchableCols =
    searchConfig?.columns && searchConfig.columns.length > 0
      ? searchConfig.columns
      : columns

  const filterableCols =
    filterConfig?.columns && filterConfig.columns.length > 0
      ? filterConfig.columns
      : []

  const uniqueValues: Record<string, string[]> = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    filterableCols.forEach((c) => (map[c] = new Set<string>()))
    rows.forEach((r) => {
      filterableCols.forEach((c) => map[c].add(String((r as any)[c] ?? "")))
    })
    const out: Record<string, string[]> = {}
    Object.entries(map).forEach(([k, v]) => (out[k] = Array.from(v)))
    return out
  }, [rows, filterableCols.join("|")])

  const filtered = useMemo(() => {
    let result = rows
    for (const col of filterableCols) {
      const selected = filters[col]
      if (selected && Array.isArray(selected) && selected.length > 0) {
        const set = new Set(selected.map(String))
        result = result.filter((r) => set.has(String((r as any)[col] ?? "")))
      } else if (typeof selected === "string" && selected.length > 0) {
        result = result.filter(
          (r) => String((r as any)[col] ?? "") === selected
        )
      }
    }
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter((r) =>
        searchableCols.some((c) =>
          String((r as any)[c] ?? "")
            .toLowerCase()
            .includes(q)
        )
      )
    }
    return result
  }, [rows, JSON.stringify(filters), query, searchableCols.join("|")])

    
  useEffect(() => {
  if (active == null) return
  if (!centerNextRef.current) return         

  const cont = listContainerRef.current
  const rowEl = rowRefs.current[active]
  if (!cont || !rowEl) return

  requestAnimationFrame(() => {
    
    const cRect = cont.getBoundingClientRect()
    const rRect = rowEl.getBoundingClientRect()
    const beforeTop = cont.scrollTop
    const targetTop =
      beforeTop + (rRect.top - cRect.top) - (cont.clientHeight / 2 - rowEl.offsetHeight / 2)

    const maxTop = cont.scrollHeight - cont.clientHeight
    const nextTop = Math.max(0, Math.min(maxTop, targetTop))

    cont.scrollTo({ top: nextTop, behavior: "auto" }) 

    centerNextRef.current = false  
  })
}, [active, filtered])


  // ---------- Jump buttons (quick find) ----------
  const jumpDefs = useMemo(
    () =>
      Object.entries(jumpButtons || {}).map(([label, rules]) => ({
        label,
        rules,
      })),
    [jumpButtons]
  )
  const matchesByLabel = useMemo(() => {
    const m = new Map<string, number[]>()
    const norm = (v: any) => String(v ?? "").toLowerCase()
    const matchRules = (
      row: any,
      filteredIndex: number,
      originalIndex: number,
      rules: Record<string, any>
    ) => {
      for (const [colRaw, termOrList] of Object.entries(rules || {})) {
        const col = String(colRaw).toLowerCase()
        let valStr: string
        if (col === "rowindex" || col === "index" || col === "__index") {
          valStr = String(originalIndex)
        } else if (col === "filteredindex" || col === "__filteredindex") {
          valStr = String(filteredIndex)
        } else {
          valStr = String((row as any)[colRaw] ?? "")
        }
        const val = norm(valStr)
        const isIndexKey =
          col === "rowindex" ||
          col === "index" ||
          col === "__index" ||
          col === "filteredindex" ||
          col === "__filteredindex"
        const valNum = Number(valStr)
        const matchOne = (t: any) => {
          if (isIndexKey) {
            const tNum = Number(t)
            if (!Number.isNaN(valNum) && !Number.isNaN(tNum)) {
              return valNum === tNum
            }
            return String(t) === valStr
          }
          return val.includes(norm(t))
        }
        if (Array.isArray(termOrList)) {
          const ok = (termOrList as any[]).some((t) => matchOne(t))
          if (!ok) return false
        } else {
          if (!matchOne(termOrList)) return false
        }
      }
      return true
    }
    for (const { label, rules } of jumpDefs) {
      const idxs: number[] = []
      for (let i = 0; i < filtered.length; i++) {
        const r = filtered[i]
        const originalIdx = rows.indexOf(r)
        if (matchRules(r, i, originalIdx, rules as any)) idxs.push(i)
      }
      m.set(label, idxs)
    }
    return m
  }, [filtered, jumpDefs])
  const viewAllRows = useMemo(() => {
    if (!viewAllLabel) return [] as { row: any; idxRows: number }[]
    const idxs = matchesByLabel.get(viewAllLabel) || []
    return idxs.map((i) => {
      const row = filtered[i]
      const idxRows = rows.indexOf(row)
      return { row, idxRows }
    })
  }, [viewAllLabel, matchesByLabel, filtered, rows])
  const handleJump = useCallback(
    (label: string) => {
      const idxs = matchesByLabel.get(label) || []
      if (!idxs.length) return
      const cur = active ?? -1
      const next = idxs.find((i) => i > cur) ?? idxs[0]
      centerNextRef.current = true
      setActive(next)
      onSelect(filtered[next], next)
      // flash active style briefly, then revert
      setActiveJump(label)
      if (jumpFlashTimerRef.current != null) {
        window.clearTimeout(jumpFlashTimerRef.current)
      }
      jumpFlashTimerRef.current = window.setTimeout(() => {
        setActiveJump((curLabel) => (curLabel === label ? null : curLabel))
        jumpFlashTimerRef.current = null
      }, 600)
    },
    [matchesByLabel, active, filtered, onSelect]
  )

  const colLower = useMemo(
    () => columns.map((c) => String(c).toLowerCase()),
    [columns]
  )
  const layoutOrder = useMemo(
    () => layout?.columns?.map((c) => c.name) || null,
    [layout]
  )
  const gridTemplate = useMemo(() => {
    
    const visibleCols =
      layoutOrder && layoutOrder.length > 0 ? layoutOrder : columns

    if (visibleCols.length <= 1) return "minmax(0, 1fr)"

    
    
    const CHAR_PX = 7
    const PADDING_PX = 16
    const MIN_PX = 60
    const MAX_PX = 420

    
    const maxCharsByCol: Record<string, number> = {}
    for (const c of visibleCols) maxCharsByCol[c] = String(c).length
    for (const r of filtered) {
      for (const c of visibleCols) {
        const v = String((r as any)[c] ?? "")
        const len = v.length
        if (len > (maxCharsByCol[c] || 0)) maxCharsByCol[c] = len
      }
    }

    
    const parts = visibleCols.map((c, idx) => {
      const isLast = idx === visibleCols.length - 1
      if (isLast) return "minmax(0, 1fr)"
      const ch = Math.max(0, maxCharsByCol[c] ?? 0)
      const px = Math.min(Math.max(ch * CHAR_PX + PADDING_PX, MIN_PX), MAX_PX)
      return `${Math.round(px)}px`
    })
    return parts.join(" ")
    
  }, [columns, layoutOrder, filtered])

  return (
    <div>
      {showHeader && <div style={s.header}>Error Log (Short)</div>}
      {(() => {
        // alarmNote: AlarmNote | AlarmNote[] | null
        const normalized =
          alarmNote == null
            ? []
            : Array.isArray(alarmNote)
            ? alarmNote
            : [alarmNote];

        
        const notes = normalized
          .map(n => (typeof n === "string" ? { text: n, level: "info" as const } : n))
          .filter((n): n is { text: string; level?: "info" | "warn" | "error" } => !!n && !!n.text);

        if (notes.length === 0) return null;

        return (
          <div style={s.notesWrap}>
            {notes.map((note, i) => {
              const lv = (note.level || "info").toLowerCase();
              const badgeStyle =
                lv === "error" ? s.noteBadgeError : lv === "warn" ? s.noteBadgeWarn : s.noteBadgeInfo;
              return (
                <span key={`note-${i}`} style={{ ...s.noteBadgeBase, ...badgeStyle }}>
                  {lv === "error" ? (
                    <IconError size={14} />
                  ) : lv === "warn" ? (
                    <IconWarn size={14} />
                  ) : (
                    <IconInfo size={14} />
                  )}
                  <span>{note.text}</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      <div style={{ ...s.searchRow, alignItems: "center" }}>
        <div style={s.searchBox}>
          <span style={s.searchIcon}>
            <IconSearch color={accent} size={14} />
          </span>
          <input
            style={{
              ...s.input,
              height: 32,
              borderRadius: 999,
              paddingLeft: 30,
              width: searchFocused || query ? 260 : 140,
              transition:
                "width 160ms ease, border-color 120ms ease, box-shadow 120ms ease",
              border: searchFocused
                ? `1px solid ${accent}`
                : (s.input as any).border,
              boxShadow: searchFocused
                ? "0 0 0 2px rgba(25,118,210,0.15)"
                : "none",
              outline: "none",
              caretColor: accent,
            }}
            placeholder={"Search ..."}
            value={query}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(!!query)}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div ref={filterWrapRef} style={{ position: "relative" }}>
          <button
            style={{
              ...s.filterButton,
              ...(filterOpen ? (s as any).filterButtonActive : {}),
            }}
            onClick={() => setFilterOpen((v) => !v)}
            aria-pressed={filterOpen}
          >
            <IconFilter color={filterOpen ? "#fff" : accent} size={14} />
            Filter
          </button>
          {filterOpen && (
            <div style={s.popover}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>
                Filters
              </div>
              {filterableCols.length === 0 && (
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  No filterable columns
                </div>
              )}
              {filterableCols.map((c) => (
                <div key={c} style={{ marginBottom: 8 }}>
                  <div
                    style={{ fontWeight: 500, marginBottom: 4, fontSize: 12 }}
                  >
                    {c}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      maxHeight: 120,
                      overflow: "auto",
                    }}
                  >
                    {uniqueValues[c]?.map((v) => {
                      const selected = (
                        filters[c] as string[] | undefined
                      )?.includes(v)
                      return (
                        <label
                          key={v}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: `1px solid ${
                              selected ? accent : "rgba(0,0,0,0.2)"
                            }`,
                            borderRadius: 999,
                            padding: "2px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            background: selected ? "#e8f1fd" : "#fff",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(e) => {
                              setFilters((prev) => {
                                const prevVals =
                                  (prev[c] as string[] | undefined) || []
                                const set = new Set(prevVals)
                                if (e.target.checked) set.add(v)
                                else set.delete(v)
                                return { ...prev, [c]: Array.from(set) }
                              })
                            }}
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  style={{
                    ...s.filterButton,
                    ...(clearPressed ? (s as any).filterButtonActive : {}),
                  }}
                  onMouseDown={() => setClearPressed(true)}
                  onMouseUp={() => setClearPressed(false)}
                  onMouseLeave={() => setClearPressed(false)}
                  onClick={() => setFilters({})}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Jump buttons row (below search) */}
      {jumpDefs.length > 0 && (
        <div
          ref={jumpRowRef}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            margin: "4px 0 8px 0",
          }}
        >
          {jumpDefs
            .filter(({ label }) => (matchesByLabel.get(label)?.length || 0) > 0)
            .map(({ label }) => (
              <div key={label} style={s.splitWrap}>
                <button
                  style={{
                    ...s.splitMain,
                    ...(activeJump === label ? (s as any).splitActive : {}),
                    ...(openJumpMenu === label
                      ? { borderBottomLeftRadius: 10 }
                      : {}),
                  }}
                  onClick={() => handleJump(label)}
                  aria-pressed={activeJump === label}
                  title={`Jump: ${label}`}
                >
                  {label}
                  {(() => {
                    const c = matchesByLabel.get(label)?.length || 0
                    return c > 0 ? ` (${c})` : ""
                  })()}
                </button>
                <button
                  style={{
                    ...s.splitCaretBtn,
                    borderLeft: `1px solid ${accent}` as any,
                    ...(openJumpMenu === label ? (s as any).splitActive : {}),
                    ...(openJumpMenu === label
                      ? { borderBottomRightRadius: 10 }
                      : {}),
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenJumpMenu((v) => (v === label ? null : label))
                  }}
                  aria-expanded={openJumpMenu === label}
                  title="Toggle options"
                >
                  <IconCaretMini size={12} strokeWidth={2} />
                </button>
                {openJumpMenu === label && (
                  <div
                    style={s.menu}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      style={s.menuItem}
                      onClick={() => {
                        setOpenJumpMenu(null)
                        setViewAllLabel(label)
                      }}
                    >View All</button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Selected filter chips */}
      <div style={{ marginBottom: 8 }}>
        {Object.entries(filters).map(([col, vals]) =>
          (Array.isArray(vals) ? vals : [vals])
            .filter((v) => v != null && `${v}`.length > 0)
            .map((v) => (
              <span key={`${col}:${v}`} style={s.chip}>
                {col}: {v}
                <span
                  role="button"
                  aria-label="Remove filter"
                  style={s.chipRemove}
                  onClick={() => {
                    setFilters((prev) => {
                      const cur = (prev[col] as string[] | undefined) || []
                      const next = cur.filter((x) => x !== v)
                      const out = { ...prev }
                      if (next.length > 0) (out as any)[col] = next
                      else delete (out as any)[col]
                      return out
                    })
                  }}
                >
                  <IconClose color={accent} size={12} strokeWidth={2} />
                </span>
              </span>
            ))
        )}
      </div>

      {loading && (
        <div
          style={{
            ...s.logsScroll,
            maxHeight: listMaxHeight ?? (s.logsScroll.maxHeight as number),
            minHeight: listMinHeight ?? (s.logsScroll.minHeight as number),
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ ...s.skeletonLine, height: 14 }} />
          ))}
        </div>
      )}

      {loading && (
        <div
          style={{
            ...s.logsScroll,
            maxHeight: listMaxHeight ?? (s.logsScroll.maxHeight as number),
            minHeight: listMinHeight ?? (s.logsScroll.minHeight as number),
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ ...s.skeletonLine, height: 14 }} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ opacity: 0.7, fontSize: 12 }}>No logs</div>
      )}

      {!loading && (
        <>
          {(layoutOrder ? layoutOrder.length > 1 : columns.length > 1) &&
            filtered.length > 0 && (
              <div
                style={{ ...s.tableHeader, gridTemplateColumns: gridTemplate }}
              >
                {(layoutOrder || columns).map((c) => (
                  <div key={c} style={s.th}>
                    {String(c).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          <div
            ref={listContainerRef}
            style={{
              ...s.logsScroll,
              maxHeight: listMaxHeight ?? (s.logsScroll.maxHeight as number),
              minHeight: listMinHeight ?? (s.logsScroll.minHeight as number),
            }}
          >
            {filtered.map((r, i) => {
              const display = stringifyRow(r, columns)
              const isActive = active === i
              let rowStyle: React.CSSProperties = {}
              let badgeEl: React.ReactNode = null
              const effRules = styleRules || []
              for (const rule of effRules) {
                const colName = String(rule.column || "")
                const colLowerName = colName.toLowerCase()
                let val = ""
                if (
                  colLowerName === "rowindex" ||
                  colLowerName === "index" ||
                  colLowerName === "__index"
                ) {
                  val = String(rows.indexOf(r))
                } else if (
                  colLowerName === "filteredindex" ||
                  colLowerName === "__filteredindex"
                ) {
                  val = String(i)
                } else {
                  const valRaw = (r as any)[rule.column]
                  val = String(valRaw ?? "")
                }
                let matched = false
                if (
                  rule.equals &&
                  rule.equals.some(
                    (x) => String(x).toLowerCase() === val.toLowerCase()
                  )
                )
                  matched = true
                else if (
                  rule.includes &&
                  rule.includes.some((x) =>
                    val.toLowerCase().includes(String(x).toLowerCase())
                  )
                )
                  matched = true
                else if (rule.regex) {
                  try {
                    matched = new RegExp(rule.regex, "i").test(val)
                  } catch {}
                }
                if (matched) {
                  if (rule.backgroundColor || rule.color) {
                    rowStyle = {
                      ...rowStyle,
                      background: rule.backgroundColor || rowStyle.background,
                      color: rule.color || rowStyle.color,
                    }
                  }
                  if (rule.badge) {
                    badgeEl = (
                      <span
                        style={{
                          ...s.badge,
                          background: rule.backgroundColor || "#eee",
                          color: rule.color || "#333",
                        }}
                      >
                        {val || rule.column}
                      </span>
                    )
                  }
                  break
                }
              }
              return (
                <div
                  key={i}
                  ref={el => (rowRefs.current[i] = el)}
                  style={{
                    ...s.logRow,
                    ...(isActive ? s.logRowActive : {}),
                    ...rowStyle,
                  }}
                  onClick={() => {
                    centerNextRef.current = false
                    setActive(i)
                    onSelect(r, i)
                  }}
                  title={display}
                >
                  {(
                    layoutOrder ? layoutOrder.length > 1 : columns.length > 1
                  ) ? (
                    <div
                      style={{
                        ...s.rowGrid,
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      {(layoutOrder || columns).map((c) => {
                        const idx = columns.indexOf(c as string)
                        const cLow =
                          idx >= 0 ? colLower[idx] : String(c).toLowerCase()
                        const val = (r as any)[c]
                        const showBadge = cLow === "level" && badgeEl
                        return (
                          <div key={c} style={s.td}>
                            {showBadge ? badgeEl : String(val ?? "")}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <>
                      {badgeEl}
                      <code
                        style={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                          color: "#111",
                        }}
                      >
                        {display}
                      </code>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {viewAllLabel && (
        <div style={s.modalOverlay} onClick={() => setViewAllLabel(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.menuItem}>
                View All Matches - {viewAllLabel} ({viewAllRows.length})
              </span>
              <button
                style={{
                  ...s.filterButton,
                  ...(closePressed ? (s as any).filterButtonActive : {}),
                }}
                onMouseDown={() => setClosePressed(true)}
                onMouseUp={() => setClosePressed(false)}
                onMouseLeave={() => setClosePressed(false)}
                onClick={() => setViewAllLabel(null)}
              >Close</button>
            </div>
            <div style={s.modalBody}>
              {/* Only detail logs in order: remove table header */}
              <div
                style={{
                  ...s.logsScroll,
                  maxHeight: s.logsScroll.maxHeight as number,
                }}
              >
                {viewAllRows.map(({ row, idxRows }, i) => {
                  const detailText =
                    idxRows >= 0 && detailRows[idxRows]
                      ? stringifyDetail(detailRows[idxRows], detailColumns)
                      : ""
                  if (!detailText) return null
                  return (
                    <pre
                      key={i}
                      style={{
                        margin: "0 0 8px 0",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 12,
                        color: "#111",
                        background: "#fff",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      {detailText}
                    </pre>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

















