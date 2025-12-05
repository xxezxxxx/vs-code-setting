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
import "./styles.css"

function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  const {
    name,
    data,
    df: dfRecords,
    columns,
    ui_theme,
    ref_TS,
    ref_ts,
    ts_bar_max_ms,
    ts_left_ms,
    ts_right_ms,
  } = (args || {}) as any

  // Config
  const MAX_MS = useMemo(
    () =>
      typeof ts_bar_max_ms === "number" && ts_bar_max_ms > 0
        ? ts_bar_max_ms
        : 24 * 60 * 60 * 1000,
    [ts_bar_max_ms]
  )
  const STEP_MS = 5 * 60 * 1000

  // Helpers
  const clamp = useCallback(
    (ms: number) => Math.max(0, Math.min(ms, MAX_MS)),
    [MAX_MS]
  )
  const parseRefTs = useCallback((v: unknown): Date => {
    if (v instanceof Date) return v
    if (typeof v === "number") return new Date(v)
    if (typeof v === "string") {
      const s = v.trim()
      const iso = new Date(s)
      if (!isNaN(iso.getTime())) return iso
      const m = s.match(
        /^(\d{4})[\/-](\d{2})[\/-](\d{2})[- T](\d{2}):(\d{2}):(\d{2})$/
      )
      if (m) {
        const [_, Y, M, D, h, mm, sec] = m
        return new Date(
          Number(Y),
          Number(M) - 1,
          Number(D),
          Number(h),
          Number(mm),
          Number(sec)
        )
      }
    }
    return new Date()
  }, [])

  const refDate = useMemo(
    () => parseRefTs(ref_TS ?? ref_ts),
    [parseRefTs, ref_TS, ref_ts]
  )

  // Default init ±8h (clamped to MAX_MS)
  const defaultSide = useMemo(
    () => Math.min(8 * 60 * 60 * 1000, MAX_MS),
    [MAX_MS]
  )
  const [leftMs, setLeftMs] = useState<number>(() =>
    typeof ts_left_ms === "number" ? clamp(ts_left_ms) : defaultSide
  )
  const [rightMs, setRightMs] = useState<number>(() =>
    typeof ts_right_ms === "number" ? clamp(ts_right_ms) : defaultSide
  )

  const toIso = (d: Date) => new Date(d.getTime()).toISOString()

  // Theme -> CSS variables
  const cssVars = useMemo(() => {
    const accent = ui_theme?.accentColor ?? theme?.primaryColor ?? "#1976d2"
    const bg =
      ui_theme?.secondaryBackgroundColor ??
      theme?.secondaryBackgroundColor ??
      "#ffffff"
    const fg = ui_theme?.textColor ?? theme?.textColor ?? "#262730"
    const border = ui_theme?.borderColor ?? "#E6E6E9"
    const secondary =
      ui_theme?.backgroundColor ?? theme?.backgroundColor ?? "#ffffff"
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
  const rows = useMemo<Row[]>(
    () => (Array.isArray(dfRecords) ? dfRecords : []),
    [dfRecords]
  )
  const cols = useMemo<string[]>(() => {
    if (Array.isArray(columns) && columns.length) return columns
    if (rows.length > 0) return Object.keys(rows[0] as Record<string, unknown>)
    return []
  }, [columns, rows])

  // Frame height
  useEffect(() => {
    Streamlit.setFrameHeight()
  }, [rows, cols, cssVars, theme, leftMs, rightMs])

  // Emit on change
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

  const onLeftChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = clamp(Number(e.target.value) || 0)
      const v = clamp(MAX_MS - raw) // move leftwards increases magnitude
      setLeftMs(v)
      emitRange(v, rightMs)
    },
    [MAX_MS, clamp, rightMs, emitRange]
  )

  const onRightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = clamp(Number(e.target.value) || 0)
      setRightMs(v)
      emitRange(leftMs, v)
    },
    [clamp, leftMs, emitRange]
  )

  // Idle fade for top labels
  const [labelsActive, setLabelsActive] = useState(true)
  const idleTimer = useRef<number | null>(null)
  const bumpLabels = useCallback(() => {
    setLabelsActive(true)
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current)
    }
    idleTimer.current = window.setTimeout(() => setLabelsActive(false), 1500)
  }, [])

  useEffect(() => {
    // show briefly on mount or when ref changes
    bumpLabels()
  }, [bumpLabels, refDate])

  // Ticks
  const TICKS = useMemo(
    () =>
      [
        { ms: 4 * 60 * 60 * 1000, label: "4h", major: false },
        { ms: 8 * 60 * 60 * 1000, label: "8h", major: false },
        { ms: 16 * 60 * 60 * 1000, label: "16h", major: false },
        { ms: 24 * 60 * 60 * 1000, label: "1d", major: true },
      ].filter((t) => t.ms <= MAX_MS),
    [MAX_MS]
  )

  // Rendering values
  const pctLeft = (leftMs / MAX_MS) * 50
  const pctRight = (rightMs / MAX_MS) * 50
  const pad2 = (n: number) => String(n).padStart(2, "0")
  const fmtTime = (d: Date) =>
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
  const refTimeStr = fmtTime(refDate)
  const refDateStr = fmtDate(refDate)

  return (
    <div className="tv-container" style={cssVars}>
      <header className="tv-header">
        <h3 className="tv-title">{name ?? "Table Viewer"}</h3>
        <div
          className="tv-actions"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <div className="tv-tsbar">
            <div
              className={
                "tv-tstrack" +
                (labelsActive ? " labels-active" : " labels-idle")
              }
            >
              <div className="tv-tscenter" />
              <div className="tv-tsticks">
                {TICKS.map((t) => {
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
                        style={{ left: `calc(50% - ${pct}% - 1px)` }}
                      >
                        <span className="tv-tstick-label">-{t.label}</span>
                      </div>
                      <div
                        className={
                          "tv-tstick right" +
                          (t.major ? " major" : "") +
                          (passedR ? " passed-right" : "") +
                          (isEnd ? " endpoint" : "")
                        }
                        style={{ left: `calc(50% + ${pct}% - 1px)` }}
                      >
                        <span className="tv-tstick-label">{t.label}</span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Center ref TS label at top */}
              <div
                className="tv-tsref-label"
                style={{ left: "50%", transform: "translateX(-50%)" }}
              >
                <div className="center-date">{refDateStr}</div>
                <div className="center-time">{refTimeStr}</div>
              </div>

              {/* Floating labels that follow the handles */}
              {leftMs > 0 &&
                (() => {
                  const d = new Date(refDate.getTime() - leftMs)
                  return (
                    <div
                      className="tv-tsdrag-label left"
                      style={{
                        left: `calc(50% - ${pctLeft}%)`,
                        transform: "translate(-50%, -4px)",
                      }}
                    >
                      <div className="drag-date">{fmtDate(d)}</div>
                      <div className="drag-time">{fmtTime(d)}</div>
                    </div>
                  )
                })()}
              {rightMs > 0 &&
                (() => {
                  const d = new Date(refDate.getTime() + rightMs)
                  return (
                    <div
                      className="tv-tsdrag-label right"
                      style={{
                        left: `calc(50% + ${pctRight}%)`,
                        transform: "translate(-50%, -4px)",
                      }}
                    >
                      <div className="drag-date">{fmtDate(d)}</div>
                      <div className="drag-time">{fmtTime(d)}</div>
                    </div>
                  )
                })()}

              <div
                className="tv-tsfill-left"
                style={{ width: `${pctLeft}%` }}
              />
              <div
                className="tv-tsfill-right"
                style={{ width: `${pctRight}%` }}
              />
              <input
                type="range"
                className="tv-tsslider left"
                min={0}
                max={MAX_MS}
                step={STEP_MS}
                value={MAX_MS - leftMs}
                onChange={(e) => {
                  onLeftChange(e)
                  bumpLabels()
                }}
                onInput={(e) => {
                  onLeftChange(e as any)
                  bumpLabels()
                }}
                onMouseDown={() => {
                  bumpLabels()
                }}
                onTouchStart={() => {
                  bumpLabels()
                }}
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
                onChange={(e) => {
                  onRightChange(e)
                  bumpLabels()
                }}
                onInput={(e) => {
                  onRightChange(e as any)
                  bumpLabels()
                }}
                onMouseDown={() => {
                  bumpLabels()
                }}
                onTouchStart={() => {
                  bumpLabels()
                }}
                disabled={disabled}
                aria-label="Right range"
              />
            </div>
          </div>
        </div>
      </header>

      <section className="tv-content">
        {cols.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            표시할 데이터가 없습니다.
          </div>
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
                    <td key={c}>
                      {String((r as Record<string, unknown>)[c] ?? "")}
                    </td>
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
