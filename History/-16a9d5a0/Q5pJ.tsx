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
import "./styles.css"

function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  // Args from Python
  const { name, data, df: dfRecords, columns, ui_theme, ref_TS, ref_ts, ts_bar_max_ms, ts_left_ms, ts_right_ms } = (args || {}) as {
    name?: string
    data?: unknown
    df?: Array<Record<string, unknown>>
    columns?: string[]
    ui_theme?: Partial<{
      accentColor: string
      backgroundColor: string
      secondaryBackgroundColor: string
      textColor: string
      borderColor: string
      rowAlt: string
      hover: string
    }>
    ref_TS?: string | number
    ref_ts?: string | number
    ts_bar_max_ms?: number
    ts_left_ms?: number
    ts_right_ms?: number
  }

  // TS range options (symmetric windows around ref_TS)
  const MAX_MS = useMemo(() => (typeof ts_bar_max_ms === "number" && ts_bar_max_ms > 0 ? ts_bar_max_ms : 24 * 60 * 60 * 1000), [ts_bar_max_ms])
  const STEP_MS = 5 * 60 * 1000 // 5분 단위
  const [leftMs, setLeftMs] = useState<number>(() => (typeof ts_left_ms === "number" ? Math.max(0, Math.min(ts_left_ms, MAX_MS)) : 0))
  const [rightMs, setRightMs] = useState<number>(() => (typeof ts_right_ms === "number" ? Math.max(0, Math.min(ts_right_ms, MAX_MS)) : 0))

  const parseRefTs = useCallback((v: unknown): Date => {
    if (v instanceof Date) return v
    if (typeof v === "number") return new Date(v)
    if (typeof v === "string") {
      const s = v.trim()
      const iso = new Date(s)
      if (!isNaN(iso.getTime())) return iso
      const m = s.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})[- T](\d{2}):(\d{2}):(\d{2})$/)
      if (m) {
        const [_, Y, M, D, h, mm, sec] = m
        return new Date(Number(Y), Number(M) - 1, Number(D), Number(h), Number(mm), Number(sec))
      }
    }
    return new Date()
  }, [])

  const refDate = useMemo(() => parseRefTs(ref_TS ?? ref_ts), [parseRefTs, ref_TS, ref_ts])
  const toIso = (d: Date) => new Date(d.getTime()).toISOString()
  const range = useMemo(() => {
    const start = new Date(refDate.getTime() - leftMs)
    const end = new Date(refDate.getTime() + rightMs)
    return { start, end, startIso: toIso(start), endIso: toIso(end), refIso: toIso(refDate) }
  }, [refDate, leftMs, rightMs])

  // Format ref TS label: 24h time on first line, date on second line
  const pad2 = (n: number) => String(n).padStart(2, "0")
  const refTimeStr = useMemo(() => {
    const h = pad2(refDate.getHours())
    const m = pad2(refDate.getMinutes())
    const s = pad2(refDate.getSeconds())
    return `${h}:${m}:${s}`
  }, [refDate])
  const refDateStr = useMemo(() => {
    const Y = refDate.getFullYear()
    const M = pad2(refDate.getMonth() + 1)
    const D = pad2(refDate.getDate())
    return `${Y}/${M}/${D}`
  }, [refDate])

  // Theme -> CSS variables
  const cssVars = useMemo(() => {
    const accent = ui_theme?.accentColor ?? theme?.primaryColor ?? "#1976d2"
    const bg = ui_theme?.secondaryBackgroundColor ?? theme?.secondaryBackgroundColor ?? "#ffffff"
    const fg = ui_theme?.textColor ?? theme?.textColor ?? "#262730"
    const border = ui_theme?.borderColor ?? "#E6E6E9"
    const secondary = ui_theme?.backgroundColor ?? theme?.backgroundColor ?? "#ffffff"
    const rowAlt = ui_theme?.rowAlt ?? "rgba(0,0,0,0.02)"
    const hover = ui_theme?.hover ?? "rgba(0,0,0,0.05)"

    return {
      ["--tv-bg" as any]: bg,
      ["--tv-fg" as any]: fg,
      ["--tv-accent" as any]: accent,
      ["--tv-border" as any]: border,
      ["--tv-secondary" as any]: secondary,
      ["--tv-row-alt" as any]: rowAlt,
      ["--tv-hover" as any]: hover,
    } as React.CSSProperties
  }, [theme, ui_theme])

  // Data normalization
  type Row = Record<string, unknown>
  const rows = useMemo<Row[]>(() => (Array.isArray(dfRecords) ? dfRecords : []), [dfRecords])
  const cols = useMemo<string[]>(() => {
    if (Array.isArray(columns) && columns.length) return columns
    if (rows.length > 0) return Object.keys(rows[0] as Record<string, unknown>)
    return []
  }, [columns, rows])

  // Frame height
  useEffect(() => {
    Streamlit.setFrameHeight()
  }, [rows, cols, cssVars, theme, leftMs, rightMs])

  // Emit when range changes (explicit user action)
  const emitRange = useCallback(
    (l: number, r: number) => {
      const start = new Date(refDate.getTime() - l)
      const end = new Date(refDate.getTime() + r)
      Streamlit.setComponentValue({
        type: "ts_range",
        leftMs: l,
        rightMs: r,
        refTs: toIso(refDate),
        start: toIso(start),
        end: toIso(end),
        meta: data,
      })
    },
    [refDate, data]
  )

  const onLeftChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Math.max(0, Math.min(Number(e.target.value), MAX_MS))
    const v = Math.max(0, Math.min(MAX_MS - raw, MAX_MS)) // 왼쪽으로 갈수록 값(음수 크기)이 커짐
    setLeftMs(v)
    emitRange(v, rightMs)
  }, [MAX_MS, rightMs, emitRange])

  const onRightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(0, Math.min(Number(e.target.value), MAX_MS))
    setRightMs(v)
    emitRange(leftMs, v)
  }, [MAX_MS, leftMs, emitRange])

  const pctLeft = (leftMs / MAX_MS) * 50
  const pctRight = (rightMs / MAX_MS) * 50

  const fmtDur = (ms: number): string => {
    const d = Math.floor(ms / (24 * 60 * 60 * 1000))
    const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    if (d > 0) return m > 0 ? `${d}d ${h}h` : `${d}d ${h}h`
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
    return `${m}m`
  }
  // Days/Hours fixed format (always show d and h) for handle labels
  const fmtDh = (ms: number): string => {
    const d = Math.floor(ms / (24 * 60 * 60 * 1000))
    const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    return `${d}d${h}h`
  }

  // Tick marks (±4h, 8h, 16h, 1d). Skip if beyond MAX_MS
  const TICKS = useMemo(
    () => [
      { ms: 4 * 60 * 60 * 1000, label: "4h", major: false },
      { ms: 8 * 60 * 60 * 1000, label: "8h", major: false },
      { ms: 16 * 60 * 60 * 1000, label: "16h", major: false },
      { ms: 24 * 60 * 60 * 1000, label: "1d", major: true },
    ].filter(t => t.ms <= MAX_MS),
    [MAX_MS]
  )

  // Drag highlighting state
  const [dragLeft, setDragLeft] = useState(false)
  const [dragRight, setDragRight] = useState(false)
  useEffect(() => {
    const end = () => {
      setDragLeft(false)
      setDragRight(false)
    }
    window.addEventListener("mouseup", end)
    window.addEventListener("touchend", end)
    window.addEventListener("touchcancel", end)
    return () => {
      window.removeEventListener("mouseup", end)
      window.removeEventListener("touchend", end)
      window.removeEventListener("touchcancel", end)
    }
  }, [])

  return (
    <div className="tv-container" style={cssVars}>
      <header className="tv-header">
        <h3 className="tv-title">{name ?? "Table Viewer"}</h3>
        <div className="tv-actions" style={{flex: 1, justifyContent: "flex-end"}}>
          <div className="tv-tsbar">
            <div className={"tv-tstrack" + (dragLeft ? " drag-left" : "") + (dragRight ? " drag-right" : "") }>
              <div className="tv-tscenter" />
              <div className="tv-tsticks">
                {TICKS.map(t => {
                  const pct = (t.ms / MAX_MS) * 50
                  const passedL = leftMs >= t.ms
                  const passedR = rightMs >= t.ms
                  const isEnd = t.ms === MAX_MS
                  return (
                    <React.Fragment key={t.ms}>
                      <div
                        className={
                          "tv-tstick left" +
                          (t.major ? " major" : "") +
                          (passedL ? " passed-left" : "") +
                          (isEnd ? " endpoint" : "")
                        }
                        style={{ left: `calc(50% - ${pct}%)`, transform: "translateX(-50%)" }}
                      >
                        <span className="tv-tstick-label">{t.label}</span>
                      </div>
                      <div
                        className={
                          "tv-tstick right" +
                          (t.major ? " major" : "") +
                          (passedR ? " passed-right" : "") +
                          (isEnd ? " endpoint" : "")
                        }
                        style={{ left: `calc(50% + ${pct}%)`, transform: "translateX(-50%)" }}
                      >
                        <span className="tv-tstick-label">{t.label}</span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
              {/* Center ref TS label at top */
              <div className="tv-tsref-label" style={{ left: "50%", transform: "translateX(-50%)" }}>
                <div className="center-date">{refDateStr}</div>
                <div className="center-time">{refTimeStr}</div>
              </div>
              <div className="tv-tsfill-left" style={{ width: `${pctLeft}%` }} />
              <div className="tv-tsfill-right" style={{ width: `${pctRight}%` }} />
              <input
                type="range"
                className="tv-tsslider left"
                min={0}
                max={MAX_MS}
                step={STEP_MS}
                value={MAX_MS - leftMs}
                onChange={onLeftChange}
                onInput={onLeftChange}
                onMouseDown={() => setDragLeft(true)}
                onTouchStart={() => setDragLeft(true)}
                disabled={disabled}
                aria-label="Left range"
              />
              <input
                type="range"
                className="tv-tsslider right"
                min={0}
                max={MAX_MS}
                step={STEP_MS}
                value={rightMs}
                onChange={onRightChange}
                onInput={onRightChange}
                onMouseDown={() => setDragRight(true)}
                onTouchStart={() => setDragRight(true)}
                disabled={disabled}
                aria-label="Right range"
              />
            </div>
            {/* Bottom labels: show current ± durations (as before) */}
            <div className="tv-tslabels">
              <span className="left">-{fmtDur(leftMs)}</span>
              <span className="right">{fmtDur(rightMs)}+</span>
            </div>
          </div>
        </div>
      </header>

      <section className="tv-content">
        {cols.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>표시할 데이터가 없습니다.</div>
        ) : (
          <table className="tv-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  {cols.map((c) => (
                    <td key={c}>{String((r as Record<string, unknown>)[c] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default withStreamlitConnection(MyComponent)
