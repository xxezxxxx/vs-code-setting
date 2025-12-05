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
type AlarmNoteProp = AlarmNote | AlarmNote[]
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
  shortlog_alarm_note?: AlarmNoteProp
  report_detail_alarm_note?: AlarmNoteProp
  alarmNote?: AlarmNoteProp
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
  detail_min_height?: number | null // Detail ?⑤꼸 maxHeight
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
    whiteSpace: "nowrap",
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
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 8px",
    borderRadius: 10,
    background: "#e8f1fd",
    color: accent,
    border: `1px solid ${accent}`,
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "nowrap" as const,
    alignSelf: "flex-start" as const,
  } as React.CSSProperties,
  noteBadgeWarn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 8px",
    borderRadius: 10,
    background: "#fff8e1",
    color: "#f57c00",
    border: "1px solid #f57c00",
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "nowrap" as const,
    alignSelf: "flex-start" as const,
  } as React.CSSProperties,
  noteBadgeError: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 8px",
    borderRadius: 10,
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #c62828",
    fontSize: 12,
    marginBottom: 6,
    whiteSpace: "nowrap" as const,
    alignSelf: "flex-start" as const,
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
    whiteSpace: "nowrap"
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
    color: "inherit",
    fontSize: 12,
  } as React.CSSProperties,
  logsScroll: {
    minHeight: 0,
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
  notesWrap: {
  display: "flex",
  flexDirection: "column",
  gap: 6,            // 노트 간 간격
  marginBottom: 8,   // 아래 요소와 간격
} as React.CSSProperties,
noteBadgeBase: {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
} as React.CSSProperties,


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

// Info circle icon
function IconInfo({
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
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <line x1="12" y1="10" x2="12" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="7" r={strokeWidth / 2 + 0.5} fill={color} />
    </svg>
  )
}

// Warning triangle icon
function IconWarn({
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
      <path d="M12 3 L22 19 H2 Z" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="17" r={strokeWidth / 2 + 0.5} fill={color} />
    </svg>
  )
}

// Error circle exclamation icon
function IconError({
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
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <line x1="12" y1="7" x2="12" y2="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="17" r={strokeWidth / 2 + 0.5} fill={color} />
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
