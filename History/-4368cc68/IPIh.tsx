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

type TableData = { records?: any[]; columns?: string[] } | null | undefined

type ReportListSchema = {
  name?: string
  date?: string
  path1?: string
  path2?: string
}

type FilterConfig = {
  columns?: string[]
  initial?: Record<string, string | string[]>
}
type SearchConfig = {
  columns?: string[]
  placeholder?: string
  initial?: string
}
type AlarmNote =
  | { text: string; level?: "info" | "warn" | "error" }
  | string
  | null
type UiTheme = { accentColor?: string }
// StyleRule.column supports special keys:
// - 'rowIndex' (original index in rows)
// - 'filteredIndex' (index in current filtered view)
type StyleRule = {
  column: string
  equals?: (string | number)[]
  includes?: (string | number)[]
  regex?: string
  backgroundColor?: string
  color?: string
  badge?: boolean
}

type Args = {
  report_list?: TableData
  report_list_schema?: ReportListSchema
  report_detail_html?: string | null
  error_log_short?: TableData
  error_log_detail?: TableData
  shortlog_alarm_note?: AlarmNote
  report_detail_alarm_note?: AlarmNote
  report_cache?: Array<{
    detail_html?: string | null
    short?: TableData
    detail?: TableData
  }>
  active_report_index?: number | null
  emit_copy_events?: boolean | null
  emit_shortlog_events?: boolean | null
  selection_debounce_ms?: number | null
  shortlog_debounce_ms?: number | null
  filter_config?: FilterConfig
  search_config?: SearchConfig
  ui_theme?: UiTheme
  auto_emit_initial?: boolean | null
  shortlog_style_rules?: StyleRule[]
  shortlog_layout?: {
    columns: { name: string; width_px?: number; flex?: boolean }[]
  } | null
  // ???ъ씠利?愿???듭뀡
  max_width?: number | string | null // 而댄룷?뚰듃 理쒕? 媛濡쒗룺 (?? 960, "72rem")
  frame_height?: number | null // iframe 怨좎젙 ?믪씠 (?놁쑝硫??먮룞)
  list_max_height?: number | null // Short/Logs/ReportList 由ъ뒪??maxHeight
  detail_max_height?: number | null // Detail ?⑤꼸 maxHeight
  html_max_height?: number | null // Report HTML ?⑤꼸 maxHeight
  // ShortLog 鍮좊Ⅸ ?대룞 踰꾪듉: { label: { column: term | term[] } }
  shortlog_jump_buttons?: Record<
    string,
    Record<string, string | number | (string | number)[]>
  > | null
}

type EventShape =
  | { type: "init" }
  | { type: "report_selected"; rowIndex: number; row: any; fields?: any }
  | { type: "shortlog_row_selected"; rowIndex: number; row: any }
  | ({ type: "copied"; target: "report_detail" | "detail_log" } & {
      event_id?: number
    })

const useAccent = (args: Args, theme: any) =>
  args?.ui_theme?.accentColor || theme?.primaryColor || "#1976d2"

const useFrameHeight = (...deps: any[]) => {
  useEffect(() => {
    const t = setTimeout(() => Streamlit.setFrameHeight(), 0)
    return () => clearTimeout(t)
  }, deps)
}

function useDebouncedSender<T extends any[]>(
  sender: (...args: T) => void,
  delayMs: number
) {
  const timerRef = React.useRef<number | null>(null)
  const clear = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const schedule = (...args: T) => {
    clear()
    timerRef.current = window.setTimeout(() => {
      sender(...args)
      timerRef.current = null
    }, delayMs)
  }
  React.useEffect(() => clear, [])
  return schedule
}

/** ---------------- Collapsible(遺?쒕윭???묎린/?쇱튂湲? ---------------- */
function useCollapsible(isOpen: boolean, duration = 200) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [maxH, setMaxH] = useState<number>(isOpen ? 99999 : 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // ?꾩옱 ?믪씠瑜??쎌뼱 ?먯뿰?ㅻ윭???좊땲硫붿씠???좊룄
    const contentH = el.scrollHeight
    if (isOpen) {
      // ?ロ엺 ?곹깭 -> ?대┛ ?곹깭
      requestAnimationFrame(() => {
        setMaxH(0) // ?쒖옉??怨좎젙
        requestAnimationFrame(() => setMaxH(contentH)) // 紐⑺몴 ?믪씠濡?
      })
    } else {
      // ?대┛ ?곹깭 -> ?ロ엺 ?곹깭
      setMaxH(contentH) // ?꾩옱 ?믪씠瑜??쒖옉?먯쑝濡?
      requestAnimationFrame(() => setMaxH(0)) // 0?쇰줈 ?좊땲硫붿씠??
    }
  }, [isOpen])

  const style: React.CSSProperties = {
    overflow: "hidden",
    maxHeight: maxH,
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "translateY(0)" : "translateY(-6px)",
    transition: `max-height ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${Math.max(
      120,
      duration - 80
    )}ms ease, transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: "max-height, opacity, transform",
    pointerEvents: isOpen ? "auto" : "none",
  }
  return { ref, style }
}

/** ---------------- ?ㅽ???---------------- */
const styles = (accent: string, maxWidth?: number | string | null) => ({
  container: {
    fontFamily:
      "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "inherit",
    width: "100%",
    maxWidth: maxWidth ?? undefined,
    margin: maxWidth ? "0 auto" : undefined,
    boxSizing: "border-box",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "minmax(160px, auto) minmax(200px, auto)",
    gap: 12,
  } as React.CSSProperties,
  panel: {
    border: `1px solid rgba(0,0,0,0.08)`,
    borderRadius: 8,
    background: "rgba(0,0,0,0.02)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  } as React.CSSProperties,
  header: {
    fontWeight: 600,
    marginBottom: 8,
    fontSize: 14,
  } as React.CSSProperties,
  headerOuter: {
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 14,
  } as React.CSSProperties,
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    minHeight: 36,
    boxSizing: "border-box",
  } as React.CSSProperties,
  headerSpacer: {
    width: 64,
    height: 28,
  } as React.CSSProperties,
  itemWrap: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  } as React.CSSProperties,
  card: {
    border: `1px solid rgba(0,0,0,0.1)`,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    background: "#fff",
    cursor: "pointer",
    transition: "box-shadow 120ms ease",
  } as React.CSSProperties,
  cardActive: {
    boxShadow: `0 0 0 2px ${accent} inset`,
  } as React.CSSProperties,
  compactCard: {
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 8,
    padding: 10,
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  } as React.CSSProperties,
  listScroll: {
    maxHeight: 220,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 4,
  } as React.CSSProperties,
  button: {
    background: accent,
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    outline: "none",
    boxShadow: "none",
    userSelect: "none" as const,
  } as React.CSSProperties,
  toggleIconBtn: {
    background: accent,
    color: "#fff",
    border: `1px solid ${accent}`,
    borderRadius: 999,
    height: 28,
    width: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition:
      "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
    outline: "none",
    boxShadow: "none",
    userSelect: "none" as const,
  } as React.CSSProperties,
  searchRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  } as React.CSSProperties,
  searchBox: {
    position: "relative",
    display: "inline-block",
    height: 32,
  } as React.CSSProperties,
  searchIcon: {
    position: "absolute" as const,
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    opacity: 0.9,
    fontSize: 12,
    pointerEvents: "none" as const,
  },
  input: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.2)",
    fontSize: 12,
  } as React.CSSProperties,
  filterButton: {
    background: "#fff",
    color: accent,
    border: `1px solid ${accent}`,
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,
  filterButtonActive: {
    background: accent,
    color: "#fff",
    border: `1px solid ${accent}`,
  } as React.CSSProperties,
  chip: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#e8f1fd",
    color: accent,
    border: `1px solid ${accent}`,
    borderRadius: 999,
    fontSize: 12,
    marginRight: 6,
    marginBottom: 6,
  } as React.CSSProperties,
  chipRemove: {
    cursor: "pointer",
    opacity: 0.8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "right",
    width: 16,
    height: 16,
  } as React.CSSProperties,
  // Alert/Note styles
  alertInfo: {
    display: "block",
    padding: "8px 10px",
    borderRadius: 8,
    background: "#e8f1fd",
    color: accent,
    border: `1px solid ${accent}`,
    fontSize: 12,
    marginBottom: 8,
  } as React.CSSProperties,
  alertWarn: {
    display: "block",
    padding: "8px 10px",
    borderRadius: 8,
    background: "#fff8e1",
    color: "#f57c00",
    border: "1px solid #f57c00",
    fontSize: 12,
    marginBottom: 8,
  } as React.CSSProperties,
  alertError: {
    display: "block",
    padding: "8px 10px",
    borderRadius: 8,
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #c62828",
    fontSize: 12,
    marginBottom: 8,
  } as React.CSSProperties,
  // Alarm badges (pill) with constrained width
  noteBadgeInfo: {
    display: "inline-block",
    padding: "2px 0 2px 8px",
    borderRadius: 999,
    background: "#e8f1fd",
    color: accent,
    border: `1px solid ${accent}`,
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere" as any,
    maxWidth: "60%",
  } as React.CSSProperties,
  noteBadgeWarn: {
    display: "inline-block",
    padding: "2px 0 2px 8px",
    borderRadius: 999,
    background: "#fff8e1",
    color: "#f57c00",
    border: "1px solid #f57c00",
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere" as any,
    maxWidth: "60%",
  } as React.CSSProperties,
  noteBadgeError: {
    display: "inline-block",
    padding: "2px 0 2px 8px",
    borderRadius: 999,
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #c62828",
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere" as any,
    maxWidth: "60%",
  } as React.CSSProperties,
  // Split button (Go + caret) helpers
  splitWrap: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "stretch",
    zIndex: 5,
  },
  splitMain: {
    // left main button looks like filterButton (compact)
    background: accent,
    color: "#fff",
    border: `1px solid ${accent}`,
    padding: "4px 8px",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    cursor: "pointer",
    fontSize: 9,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    outline: "none",
    boxShadow: "none",
    userSelect: "none" as const,
  } as React.CSSProperties,
  splitCaretBtn: {
    background: accent,
    color: "#fff",
    borderTop: `1px solid ${accent}`,
    borderBottom: `1px solid ${accent}`,
    borderRight: `1px solid ${accent}`,
    borderLeft: "none",
    padding: "0 6px",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    cursor: "pointer",
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 26,
    minWidth: 20,
    outline: "none",
    boxShadow: "none",
    userSelect: "none" as const,
  } as React.CSSProperties,
  splitActive: {
    background: "#fff",
    color: accent,
  } as React.CSSProperties,
  menu: {
    position: "absolute" as const,
    top: "calc(110% - 1px)",
    left: 0,
    background: "#fff",
    color: "#111",
    border: `1px solid ${accent}`,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    boxShadow: "0 10px 24px rgba(255, 255, 255, 0.14)",
    padding: 6,
    width: "100%",
    zIndex: 70,
    transformOrigin: "top center",
    animation: "s-drop 160ms ease",
  } as React.CSSProperties,
  menuItem: {
    width: "100%",
    textAlign: "left" as const,
    background: "#fff",
    color: "#111",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
  } as React.CSSProperties,
  modalOverlay: {
    position: "fixed" as const,
    inset: 0 as any,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
  } as React.CSSProperties,
  modal: {
    background: "#fff",
    borderRadius: 10,
    width: "min(1000px, 92vw)",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 16px 36px rgba(0,0,0,0.25)",
    overflow: "hidden",
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(0,0,0,0.1)",
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  modalBody: {
    padding: 10,
    overflow: "auto",
  } as React.CSSProperties,
  popover: {
    position: "absolute" as const,
    top: "calc(100% + 6px)",
    right: 0,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    padding: 10,
    width: 280,
    zIndex: 50,
    animation: "s-drop 160ms ease",
  },
  logRow: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    cursor: "pointer",
    marginBottom: 6,
  } as React.CSSProperties,
  logRowActive: {
    boxShadow: `0 0 0 2px ${accent} inset`,
  } as React.CSSProperties,
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    marginRight: 8,
    fontWeight: 600,
  } as React.CSSProperties,
  tableHeader: {
    display: "grid",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    padding: "0 4px 6px 4px",
  } as React.CSSProperties,
  th: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  rowGrid: {
    display: "grid",
    gap: 8,
    alignItems: "center",
  } as React.CSSProperties,
  td: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "#111",
    fontSize: 12,
  } as React.CSSProperties,
  logsScroll: {
    maxHeight: 280,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 4,
  } as React.CSSProperties,
  skeletonLine: {
    height: 12,
    background: "rgba(0,0,0,0.08)",
    borderRadius: 6,
    marginBottom: 8,
    animation: "s-pulse 1.2s ease-in-out infinite",
  } as React.CSSProperties,
  skeletonBlock: {
    height: 120,
    background: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    animation: "s-pulse 1.2s ease-in-out infinite",
  } as React.CSSProperties,
  toast: {
    position: "fixed" as const,
    right: 12,
    bottom: 12,
    background: accent,
    color: "#fff",
    padding: "8px 10px",
    borderRadius: 6,
    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
    opacity: 0,
    transform: "translateY(6px)",
    transition: "opacity 120ms ease, transform 120ms ease",
    pointerEvents: "none" as const,
    fontSize: 12,
  },
  inlineToast: {
    position: "absolute" as const,
    top: "calc(100% + 8px)",
    left: "50%",
    transform: "translate(-50%, 4px)",
    background: accent,
    color: "#fff",
    padding: "6px 8px",
    borderRadius: 6,
    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
    fontSize: 12,
    pointerEvents: "none" as const,
    whiteSpace: "nowrap" as const,
    opacity: 0,
    transition: "opacity 160ms ease, transform 160ms ease",
    zIndex: 20,
  } as React.CSSProperties,
  inlineToastCaret: {
    position: "absolute" as const,
    top: -5,
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderBottom: `6px solid ${accent}`,
  },
})

/** ---------------- Icons ---------------- */
function IconSearch({
  color = "#999",
  size = 14,
}: {
  color?: string
  size?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <line
        x1="16.5"
        y1="16.5"
        x2="21"
        y2="21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconFilter({
  color = "#999",
  size = 14,
}: {
  color?: string
  size?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 5H21L14 12V19L10 21V12L3 5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * ??open) ????closed) 紐⑥뼇???뚯쟾?쇰줈 ?꾪솚
 * - 湲곕낯 紐⑥뼇: ?꾨옒履?爰얠뇿(chevron-down)
 * - ?ロ옒: -90deg ?뚯쟾 ??醫뚯륫 爰얠뇿(?? ?먮굦
 */
function IconChevronAnimated({
  color = "#666",
  size = 16,
  open = true,
}: {
  color?: string
  size?: number
  open?: boolean
}) {
  // ?ロ옒 ?곹깭????醫뚯륫(<)??媛由ы궎?꾨줉 +90???뚯쟾
  const rotation = open ? 0 : 90
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: "transform 160ms ease",
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Minimal chevron (caret) icon – thin V shape
function IconCaretMini({
  color = "currentColor",
  size = 12,
  strokeWidth = 2,
}: {
  color?: string
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconClose({
  color = "#888",
  size = 12,
  strokeWidth = 2,
}: {
  color?: string
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** ---------------- Utils ---------------- */
function stringifyRow(row: any, columns?: string[]) {
  if (!row) return ""
  if (typeof row === "string") return row
  if (columns && columns.length) {
    const primary = ["message", "text", "value"].find((k) => k in row)
    if (primary) return String(row[primary])
    return columns
      .map((c) => String(row[c] ?? ""))
      .filter(Boolean)
      .join("  |  ")
  }
  const keys = Object.keys(row)
  return keys.map((k) => `${k}: ${String(row[k])}`).join("  |  ")
}

function stringifyDetail(row: any, columns?: string[]) {
  if (!row) return ""
  if (typeof row === "string") return row
  const prefer = [
    "full",
    "detail",
    "stack",
    "trace",
    "error",
    "value",
    "message",
    "text",
  ]
  const key = prefer.find((k) => k in row)
  if (key) return String(row[key])
  return stringifyRow(row, columns)
}

function htmlToPlain(html: string): string {
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return (tmp.textContent || (tmp as any).innerText || "").trim()
}

function useFixedHeight(height?: number) {
  useEffect(() => {
    if (height && Number.isFinite(height)) {
      Streamlit.setFrameHeight(height)
    } else {
      Streamlit.setFrameHeight()
    }
  }, [height])
}

async function copyHtmlToClipboard(html: string): Promise<void> {
  const plain = htmlToPlain(html)
  try {
    const anyWin: any = window as any
    if (
      navigator.clipboard &&
      anyWin.ClipboardItem &&
      typeof navigator.clipboard.write === "function"
    ) {
      const item = new anyWin.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      })
      await navigator.clipboard.write([item])
      return
    }
  } catch {}
  await new Promise<void>((resolve, reject) => {
    const onCopy = (e: ClipboardEvent) => {
      try {
        e.clipboardData?.setData("text/html", html)
        e.clipboardData?.setData("text/plain", plain)
        e.preventDefault()
        document.removeEventListener("copy", onCopy, true)
        resolve()
      } catch (err) {
        document.removeEventListener("copy", onCopy, true)
        reject(err as any)
      }
    }
    document.addEventListener("copy", onCopy, true)
    const ok = document.execCommand("copy")
    if (!ok) {
      setTimeout(() => {
        document.removeEventListener("copy", onCopy, true)
        resolve()
      }, 0)
    }
  })
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if ((navigator.clipboard as any)?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
  } catch {}
}

/** ---------------- Sub-Views ---------------- */
function ReportListView(props: {
  data?: TableData
  schema?: ReportListSchema
  onSelect: (row: any, index: number) => void
  accent: string
  activeIndex?: number | null
  showHeader?: boolean
  listMaxHeight?: number | null
}) {
  const {
    data,
    schema,
    onSelect,
    accent,
    activeIndex,
    showHeader = true,
    listMaxHeight,
  } = props
  const s = styles(accent)
  const [localActive, setLocalActive] = useState<number | null>(null)
  const records = data?.records || []

  const nameKey = schema?.name || "name"
  const dateKey = schema?.date || "date"
  const path1Key = schema?.path1 || "path1"
  const path2Key = schema?.path2 || "path2"

  return (
    <div>
      {showHeader && <div style={s.header}>Report List</div>}
      <div
        style={{
          ...s.listScroll,
          maxHeight: listMaxHeight ?? (s.listScroll.maxHeight as number),
        }}
      >
        {records.length === 0 && (
          <div style={{ opacity: 0.7, fontSize: 12 }}>No reports</div>
        )}
        {records.map((r, i) => {
          const isActive = (activeIndex ?? localActive) === i
          return (
            <div
              key={i}
              style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}
              onClick={() => {
                setLocalActive(i)
                onSelect(r, i)
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {String(r?.[nameKey] ?? "(no name)")}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#555",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={String(r?.[path2Key] ?? "")}
                  >
                    {String(r?.[path2Key] ?? "")}
                  </div>
                </div>
                <div
                  style={{ opacity: 0.8, fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {String(r?.[dateKey] ?? "")}
                </div>
              </div>
              <div
                style={{
                  marginTop: 0,
                  fontSize: 12,
                  color: "#555",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span title={String(r?.[path1Key] ?? "")}>
                  {String(r?.[path1Key] ?? "")}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HtmlPanel(props: {
  title: string
  html?: string | null
  onCopy: () => void
  accent: string
  loading?: boolean
  showHeader?: boolean
  maxHeight?: number | null
}) {
  const {
    title,
    html,
    onCopy,
    accent,
    loading,
    showHeader = true,
    maxHeight,
  } = props
  const s = styles(accent)
  const [copied, setCopied] = useState(false)

  const copyHtml = async () => {
    try {
      if (!html) return
      await copyHtmlToClipboard(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
      onCopy()
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
      onCopy()
    }
  }

  return (
    <div>
      {showHeader && null}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: 10,
          overflow: "auto",
          maxHeight: maxHeight ?? 420,
        }}
      >
        {loading ? (
          <div>
            <div style={{ ...s.skeletonLine, width: "60%" }} />
            <div style={{ ...s.skeletonLine, width: "80%" }} />
            <div style={{ ...s.skeletonLine, width: "90%" }} />
            <div style={{ ...s.skeletonLine, width: "40%" }} />
          </div>
        ) : html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div style={{ opacity: 0.7, fontSize: 12 }}>No content</div>
        )}
      </div>
    </div>
  )
}

function ShortLogView(props: {
  data?: TableData
  filterConfig?: FilterConfig
  searchConfig?: SearchConfig
  onSelect: (row: any, index: number) => void
  accent: string
  loading?: boolean
  showHeader?: boolean
  styleRules?: StyleRule[]
  listMaxHeight?: number | null
  layout?: {
    columns: { name: string; width_px?: number; flex?: boolean }[]
  } | null
  jumpButtons?: Record<
    string,
    Record<string, string | number | (string | number)[]>
  > | null
  detailData?: TableData
  alarmNote?: AlarmNote
}) {
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
    layout,
    jumpButtons,
    detailData,
    alarmNote,
  } = props
  const s = styles(accent)

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
  const filterWrapRef = React.useRef<HTMLDivElement | null>(null)
  const jumpFlashTimerRef = React.useRef<number | null>(null)
  const [clearPressed, setClearPressed] = useState(false)
  const [donePressed, setDonePressed] = useState(false)
  const [closePressed, setClosePressed] = useState(false)
  const [openJumpMenu, setOpenJumpMenu] = useState<string | null>(null)
  const [viewAllLabel, setViewAllLabel] = useState<string | null>(null)
  const jumpRowRef = React.useRef<HTMLDivElement | null>(null)

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
    // 蹂댁씠??而щ읆 ?쒖꽌: ?덉씠?꾩썐 吏?뺤씠 ?덉쑝硫?洹??쒖꽌, ?놁쑝硫??먮낯 而щ읆
    const visibleCols =
      layoutOrder && layoutOrder.length > 0 ? layoutOrder : columns

    if (visibleCols.length <= 1) return "minmax(0, 1fr)"

    // 媛?而щ읆??理쒕? 湲????湲곕컲 ?덈퉬 怨꾩궛
    // ??듭쟻??臾몄옄 ??px)怨??щ갚(px). ?덈Т ?볦뼱吏吏 ?딅룄濡?理쒖냼/理쒕? ??룄 ?쒗븳
    const CHAR_PX = 7
    const PADDING_PX = 16
    const MIN_PX = 60
    const MAX_PX = 420

    // ?ㅻ뜑 ?띿뒪?몃룄 湲몄씠 痢≪젙???ы븿
    const maxCharsByCol: Record<string, number> = {}
    for (const c of visibleCols) maxCharsByCol[c] = String(c).length
    for (const r of filtered) {
      for (const c of visibleCols) {
        const v = String((r as any)[c] ?? "")
        const len = v.length
        if (len > (maxCharsByCol[c] || 0)) maxCharsByCol[c] = len
      }
    }

    // 留덉?留?而щ읆? ?⑤뒗 怨듦컙??李⑥??섍퀬, 怨듦컙??遺議깊븯硫??대┰?섎룄濡?minmax(0,1fr)
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
        if (!alarmNote) return null
        const note =
          typeof alarmNote === "string"
            ? { text: alarmNote, level: "info" as const }
            : alarmNote
        if (!note || !note.text) return null
        const lv = (note.level || "info").toLowerCase()
        const style =
          lv === "error"
            ? s.alertError
            : lv === "warn"
            ? s.alertWarn
            : s.alertInfo
        return <div style={style}>{note.text}</div>
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
                  title="옵션 열기"
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
                    >
                      전체 보기
                    </button>
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
            style={{
              ...s.logsScroll,
              maxHeight: listMaxHeight ?? (s.logsScroll.maxHeight as number),
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
                  style={{
                    ...s.logRow,
                    ...(isActive ? s.logRowActive : {}),
                    ...rowStyle,
                  }}
                  onClick={() => {
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
              <span>
                전체 보기 - {viewAllLabel} ({viewAllRows.length})
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
              >
                닫기
              </button>
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

function DetailLogPanel(props: {
  data?: TableData
  onCopy: () => void
  accent: string
  loading?: boolean
  showHeader?: boolean
  maxHeight?: number | null
}) {
  const { data, onCopy, accent, loading, showHeader = true, maxHeight } = props
  const s = styles(accent)
  const rows = data?.records || []
  const columns = data?.columns || []
  const [copied, setCopied] = useState(false)

  const content = rows.length ? stringifyDetail(rows[0], columns) : ""

  const copyText = async () => {
    try {
      if ((navigator.clipboard as any)?.writeText) {
        await navigator.clipboard.writeText(content)
      } else {
        const el = document.createElement("textarea")
        el.value = content
        document.body.appendChild(el)
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
      onCopy()
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
      onCopy()
    }
  }

  return (
    <div>
      {showHeader && (
        <div
          style={{
            ...s.header,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Full Log (Detail)</span>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              style={{
                ...s.filterButton,
                ...(copied ? (s as any).filterButtonActive : {}),
              }}
              aria-label="Copy full log"
              disabled={!!loading}
            >
              Copy
            </button>
            {/* Inline toast?????⑤꼸 ?대??먯꽌???④?(?곷떒?먯꽌 ?ъ슜) */}
          </div>
        </div>
      )}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: 10,
          overflow: "auto",
          maxHeight: maxHeight ?? 420,
        }}
      >
        {loading ? (
          <div>
            <div style={{ ...s.skeletonLine, width: "85%", height: 14 }} />
            <div style={{ ...s.skeletonLine, width: "90%", height: 14 }} />
            <div style={{ ...s.skeletonLine, width: "70%", height: 14 }} />
            <div style={{ ...s.skeletonBlock, marginTop: 8 }} />
          </div>
        ) : content ? (
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
          </pre>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Select a log line from the short log.
          </div>
        )}
      </div>
    </div>
  )
}

/** ?묓옒 ?곹깭?먯꽌 蹂댁뿬以?而댄뙥??移대뱶 */
function CompactSelectedReport(props: {
  record?: any
  schema?: ReportListSchema
  accent: string
  onClick: () => void
}) {
  const { record, schema, accent, onClick } = props
  const s = styles(accent)
  const nameKey = schema?.name || "name"
  const dateKey = schema?.date || "date"
  const path1Key = schema?.path1 || "path1"
  const path2Key = schema?.path2 || "path2"

  if (!record) {
    return <div style={{ opacity: 0.7, fontSize: 12 }}>No selected report</div>
  }

  return (
    <div style={s.compactCard} onClick={onClick} title="Expand report list">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {String(record?.[nameKey] ?? "(no name)")}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#555",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={String(record?.[path2Key] ?? "")}
          >
            {String(record?.[path2Key] ?? "")}
          </div>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: "#555",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={String(record?.[path1Key] ?? "")}
        >
          {String(record?.[path1Key] ?? "")}
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "nowrap" }}>
        {String(record?.[dateKey] ?? "")}
      </div>
    </div>
  )
}

/** ---------------- Main ---------------- */
function MyComponent({ args, theme }: ComponentProps): ReactElement {
  const a = (args || {}) as Args
  const accent = useAccent(a, theme)
  const s = styles(accent, a.max_width ?? null)

  // iframe ?믪씠: 怨좎젙媛??덉쑝硫?怨좎젙, ?놁쑝硫??먮룞
  useFixedHeight(a.frame_height ?? undefined)

  const [detailCopied, setDetailCopied] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)

  const send = useCallback((evt: EventShape) => {
    const payload = { ...evt, event_id: Date.now() + Math.random() }
    Streamlit.setComponentValue(payload as any)
  }, [])

  const selectionDebounce = Math.max(0, a.selection_debounce_ms ?? 200)
  const shortlogDebounce = Math.max(0, a.shortlog_debounce_ms ?? 120)
  const sendDebouncedReport = useDebouncedSender(
    (evt: EventShape) => send(evt),
    selectionDebounce
  )
  const sendDebouncedShortlog = useDebouncedSender(
    (evt: EventShape) => send(evt),
    shortlogDebounce
  )

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [localReportIndex, setLocalReportIndex] = useState<number | null>(null)
  const lastSentReportIndexRef = React.useRef<number | null>(null)
  const initialEmitDoneRef = React.useRef<boolean>(false)
  const [reportListCollapsed, setReportListCollapsed] = useState(false)

  useEffect(() => {
    if (
      typeof a.active_report_index === "number" &&
      localReportIndex != null &&
      a.active_report_index === localReportIndex
    ) {
      setLocalReportIndex(null)
    }
    if (
      typeof a.active_report_index === "number" &&
      !isNaN(a.active_report_index)
    ) {
      lastSentReportIndexRef.current = a.active_report_index
    }
  }, [a.active_report_index, localReportIndex])

  const shortLen =
    (a.error_log_short?.records?.length as number | undefined) || 0
  useEffect(() => {
    if (selectedIndex != null && selectedIndex >= shortLen) {
      setSelectedIndex(null)
    }
  }, [shortLen])

  const cache = a.report_cache
  const recordCount =
    (a.report_list?.records?.length as number | undefined) || 0
  const serverIdx =
    typeof a.active_report_index === "number" && !isNaN(a.active_report_index)
      ? a.active_report_index
      : null
  const activeIdx =
    localReportIndex != null
      ? localReportIndex
      : serverIdx != null
      ? serverIdx
      : recordCount > 0
      ? 0
      : null

  const usingCache = !!cache && activeIdx != null && cache[activeIdx]
  const cacheShort = usingCache ? cache![activeIdx!].short : undefined
  const cacheDetail = usingCache ? cache![activeIdx!].detail : undefined
  const cacheHtml = usingCache ? cache![activeIdx!].detail_html : undefined

  const shortData: TableData = usingCache ? cacheShort : a.error_log_short
  const detailData: TableData = usingCache ? cacheDetail : a.error_log_detail
  const reportHtml: string | null | undefined = usingCache
    ? cacheHtml
    : a.report_detail_html

  const detailRow =
    selectedIndex != null ? detailData?.records?.[selectedIndex] : null
  const detailColumns = detailData?.columns
  const selectedDetailData: TableData = detailRow
    ? { records: [detailRow], columns: detailColumns }
    : null

  // ?댁슜/?좉? 蹂?붿뿉 ?곕Ⅸ ?먮룞 ?믪씠 ?ш퀎??
  useFrameHeight(a, theme, selectedIndex, activeIdx, reportListCollapsed)

  const isLoadingReport = !!(localReportIndex != null && !usingCache)

  const buildFields = useCallback(
    (row: any) => {
      const schema = a.report_list_schema || {}
      const fields: any = {
        name: row?.[(schema as any).name || "name"],
        date: row?.[(schema as any).date || "date"],
        path1: row?.[(schema as any).path1 || "path1"],
        path2: row?.[(schema as any).path2 || "path2"],
      }
      const idKey = ["id", "uuid", "_id", "report_id", "index"].find(
        (k) => k in (row || {})
      )
      if (idKey) fields.id = row[idKey]
      return fields
    },
    [a.report_list_schema]
  )

  useEffect(() => {
    if (initialEmitDoneRef.current) return
    if (a.auto_emit_initial === false) return
    const idx = activeIdx
    const rows = a.report_list?.records || []
    if (idx != null && rows && rows[idx]) {
      initialEmitDoneRef.current = true
      lastSentReportIndexRef.current = idx
      const row = rows[idx]
      const fields = buildFields(row)
      send({ type: "report_selected", rowIndex: idx, row, fields } as any)
    }
  }, [activeIdx, a.report_list, a.auto_emit_initial, buildFields, send])

  useEffect(() => {
    setSelectedIndex(null)
  }, [activeIdx])

  // Collapsible wrapper ?ㅽ???李몄“
  const { ref: listWrapRef, style: listCollapseStyle } = useCollapsible(
    !reportListCollapsed,
    280
  )

  return (
    <div style={s.container}>
      <div
        style={{
          ...s.grid,
          gridTemplateRows: reportListCollapsed
            ? "minmax(56px, auto) 1fr"
            : "minmax(160px, auto) 1fr",
        }}
      >
        {/* Top-Left: Report List (Collapsible) */}
        <div style={s.itemWrap}>
          <div style={s.headerRow}>
            <div style={s.headerOuter}>Report List</div>
            <button
              style={{
                ...s.toggleIconBtn,
                background: reportListCollapsed ? accent : "#fff",
                color: reportListCollapsed ? "#fff" : accent,
                border: `1px solid ${accent}`,
              }}
              onClick={() => setReportListCollapsed((v) => !v)}
              aria-label={
                reportListCollapsed
                  ? "Expand report list"
                  : "Collapse report list"
              }
              title={reportListCollapsed ? "Expand" : "Collapse"}
            >
              <IconChevronAnimated
                color={reportListCollapsed ? "#fff" : accent}
                size={16}
                open={!reportListCollapsed}
              />
            </button>
          </div>
          <div style={s.panel}>
            {/* ?묓옒 ?곹깭: ?좏깮 移대뱶留?媛꾨왂??*/}
            {reportListCollapsed ? (
              <CompactSelectedReport
                record={(() => {
                  const list = a.report_list?.records || []
                  const idx = activeIdx ?? null
                  return idx != null ? list[idx] : undefined
                })()}
                schema={a.report_list_schema}
                accent={accent}
                onClick={() => setReportListCollapsed(false)}
              />
            ) : (
              // ?쇱묠 ?곹깭: 由ъ뒪???꾩껜 (遺?쒕윭???ロ옒???꾪빐 Collapsible ?섑띁)
              <div ref={listWrapRef} style={listCollapseStyle}>
                <ReportListView
                  data={a.report_list}
                  schema={a.report_list_schema}
                  accent={accent}
                  activeIndex={activeIdx}
                  showHeader={false}
                  listMaxHeight={a.list_max_height ?? null}
                  onSelect={(row, rowIndex) => {
                    setSelectedIndex(null)
                    setLocalReportIndex(rowIndex)
                    const fields = buildFields(row)
                    if (lastSentReportIndexRef.current !== rowIndex) {
                      lastSentReportIndexRef.current = rowIndex
                      const evt = {
                        type: "report_selected",
                        rowIndex,
                        row,
                        fields,
                      } as any
                      send(evt)
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Full Log */}
        <div style={s.itemWrap}>
          <div style={s.headerRow}>
            <div style={s.headerOuter}>Full Log (Detail)</div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                style={{
                  ...s.filterButton,
                  ...(detailCopied ? (s as any).filterButtonActive : {}),
                }}
                onClick={async () => {
                  const rows = (selectedDetailData?.records as any[]) || []
                  const cols = selectedDetailData?.columns
                  const text =
                    rows && rows.length ? stringifyDetail(rows[0], cols) : ""
                  if (text) {
                    try {
                      await (navigator.clipboard as any).writeText(text)
                    } catch {
                      const el = document.createElement("textarea")
                      el.value = text
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand("copy")
                      document.body.removeChild(el)
                    }
                  }
                  setDetailCopied(true)
                  setTimeout(() => setDetailCopied(false), 1200)
                }}
                aria-label="Copy full log"
              >
                Copy
              </button>
              <div
                style={{
                  ...s.inlineToast,
                  opacity: detailCopied ? 1 : 0,
                  transform: detailCopied
                    ? "translate(-50%, 0)"
                    : "translate(-50%, 4px)",
                }}
              >
                <span style={s.inlineToastCaret as any} />
                Copied !
              </div>
              {/* 媛꾨떒 ?좎뒪?몃뒗 ?곷떒?먯꽌 ?ъ슜 */}
            </div>
          </div>
          <div style={s.panel}>
            <DetailLogPanel
              data={selectedDetailData}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              maxHeight={
                a.detail_max_height ?? (reportListCollapsed ? 420 : 300)
              }
              onCopy={() => {
                if (a.emit_copy_events) {
                  send({ type: "copied", target: "detail_log" })
                }
              }}
            />
          </div>
        </div>

        {/* Bottom-Left: Report Detail HTML */}
        <div style={s.itemWrap}>
          <div style={s.headerRow}>
            <div style={s.headerOuter}>Report Detail</div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                style={{
                  ...s.filterButton,
                  ...(reportCopied ? (s as any).filterButtonActive : {}),
                }}
                onClick={async () => {
                  if (reportHtml) {
                    await copyHtmlToClipboard(reportHtml)
                  }
                  setReportCopied(true)
                  setTimeout(() => setReportCopied(false), 1200)
                }}
                aria-label="Copy HTML"
              >
                Copy
              </button>
              <div
                style={{
                  ...s.inlineToast,
                  opacity: reportCopied ? 1 : 0,
                  transform: reportCopied
                    ? "translate(-50%, 0)"
                    : "translate(-50%, 4px)",
                }}
              >
                <span style={s.inlineToastCaret as any} />
                Copied !
              </div>
            </div>
          </div>
          <div style={s.panel}>
            {(() => {
              const note = a.report_detail_alarm_note
              if (!note) return null
              const n =
                typeof note === "string"
                  ? { text: note, level: "info" as const }
                  : note
              if (!n || !n.text) return null
              const lv = (n.level || "info").toLowerCase()
              const style =
                lv === "error"
                  ? s.alertError
                  : lv === "warn"
                  ? s.alertWarn
                  : s.alertInfo
              return <div style={style}>{n.text}</div>
            })()}
            <HtmlPanel
              title="Report Detail"
              html={reportHtml || undefined}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              maxHeight={a.html_max_height ?? (reportListCollapsed ? 640 : 480)}
              onCopy={() => {
                if (a.emit_copy_events) {
                  send({ type: "copied", target: "report_detail" })
                }
              }}
            />
          </div>
        </div>

        {/* Bottom-Right: Short Log */}
        <div style={s.itemWrap}>
          <div style={s.headerRow}>
            <div style={s.headerOuter}>Error Log (Short)</div>
            <div style={s.headerSpacer} />
          </div>
          <div style={s.panel}>
            <ShortLogView
              key={`short-${activeIdx ?? "none"}`}
              data={shortData}
              filterConfig={a.filter_config}
              searchConfig={a.search_config}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              styleRules={a.shortlog_style_rules}
              layout={a.shortlog_layout as any}
              jumpButtons={a.shortlog_jump_buttons as any}
              alarmNote={a.shortlog_alarm_note as any}
              detailData={detailData}
              listMaxHeight={a.list_max_height ?? null}
              onSelect={(row, rowIndex) => {
                setSelectedIndex(rowIndex)
                if (a.emit_shortlog_events) {
                  sendDebouncedShortlog({
                    type: "shortlog_row_selected",
                    rowIndex,
                    row,
                  })
                }
              }}
            />
          </div>
        </div>
      </div>
      <style>{`@keyframes s-pulse { 0% { opacity: .6 } 50% { opacity: 1 } 100% { opacity: .6 } }
@keyframes s-drop { from { opacity: 0; transform: translateY(-6px) scaleY(0.96); } to { opacity: 1; transform: translateY(0) scaleY(1); } }
button:focus, button:focus-visible { outline: none !important; box-shadow: none !important; }
button::-moz-focus-inner { border: 0; }`}</style>
    </div>
  )
}

export default withStreamlitConnection(MyComponent)
