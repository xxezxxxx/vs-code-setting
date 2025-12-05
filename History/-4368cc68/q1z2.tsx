import type { ReactElement } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"

import CompactSelectedReport from "./components/CompactSelectedReport"
import DetailLogPanel from "./components/DetailLogPanel"
import HtmlPanel from "./components/HtmlPanel"
import ReportListView from "./components/ReportListView"
import ShortLogView from "./components/ShortLogView"
import { IconChevronAnimated, IconError, IconInfo, IconWarn } from "./icons"
import { createStyles } from "./styles"
import { stringifyDetail, copyHtmlToClipboard } from "./utils"
import {
  useAccent,
  useCollapsible,
  useDebouncedSender,
  useFrameHeight,
  useFixedHeight,
} from "./hooks"
import type { Args, EventShape, TableData } from "./types"

function normalizeAlarmNotes(
  raw: Args["report_detail_alarm_note"],
  styleMap: ReturnType<typeof createStyles>
) {
  const input = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  return input
    .map((note) =>
      typeof note === "string" ? { text: note, level: "info" as const } : note
    )
    .filter(
      (note): note is { text: string; level?: "info" | "warn" | "error" } =>
        !!note && typeof note.text === "string" && note.text.length > 0
    )
    .map((note) => {
      const level = (note.level || "info").toLowerCase() as
        | "info"
        | "warn"
        | "error"
      const style =
        level === "error"
          ? { ...styleMap.noteBadgeBase, ...styleMap.noteBadgeError }
          : level === "warn"
          ? { ...styleMap.noteBadgeBase, ...styleMap.noteBadgeWarn }
          : { ...styleMap.noteBadgeBase, ...styleMap.noteBadgeInfo }
      return { text: note.text, level, style }
    })
}

function MyComponent({ args, theme }: ComponentProps): ReactElement {
  const a = (args || {}) as Args
  const accent = useAccent(a, theme)
  const s = useMemo(
    () => createStyles(accent, a.max_width ?? null),
    [accent, a.max_width]
  )

  useFixedHeight(a.frame_height ?? undefined)

  const [detailCopied, setDetailCopied] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)

  const send = useCallback((evt: EventShape) => {
    const payload = { ...evt, event_id: Date.now() + Math.random() }
    Streamlit.setComponentValue(payload as any)
  }, [])

  const shortlogDebounce = Math.max(0, a.shortlog_debounce_ms ?? 120)
  const sendDebouncedShortlog = useDebouncedSender(
    (evt: EventShape) => send(evt),
    shortlogDebounce
  )

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [localReportIndex, setLocalReportIndex] = useState<number | null>(null)
  const lastSentReportIndexRef = useRef<number | null>(null)
  const initialEmitDoneRef = useRef<boolean>(false)
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
      !Number.isNaN(a.active_report_index)
    ) {
      lastSentReportIndexRef.current = a.active_report_index
    }
  }, [a.active_report_index, localReportIndex])

  const shortLength =
    (a.error_log_short?.records?.length as number | undefined) || 0
  useEffect(() => {
    if (selectedIndex != null && selectedIndex >= shortLength) {
      setSelectedIndex(null)
    }
  }, [shortLength, selectedIndex])

  const cache = a.report_cache
  const reportCount =
    (a.report_list?.records?.length as number | undefined) || 0
  const serverIndex =
    typeof a.active_report_index === "number" &&
    !Number.isNaN(a.active_report_index)
      ? a.active_report_index
      : null
  const activeIndex =
    localReportIndex != null
      ? localReportIndex
      : serverIndex != null
      ? serverIndex
      : reportCount > 0
      ? 0
      : null

  const usingCache = !!cache && activeIndex != null && cache[activeIndex]
  const cacheShort = usingCache ? cache![activeIndex!].short : undefined
  const cacheDetail = usingCache ? cache![activeIndex!].detail : undefined
  const cacheHtml = usingCache ? cache![activeIndex!].detail_html : undefined

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

  useFrameHeight(a, theme, selectedIndex, activeIndex, reportListCollapsed)

  const isLoadingReport = !!(localReportIndex != null && !usingCache)

  const buildFields = useCallback(
    (row: any) => {
      const schema = a.report_list_schema || {}
      const fields: Record<string, unknown> = {
        name: row?.[(schema as any).name || "name"],
        date: row?.[(schema as any).date || "date"],
        path1: row?.[(schema as any).path1 || "path1"],
        path2: row?.[(schema as any).path2 || "path2"],
      }
      const idKey = ["id", "uuid", "_id", "report_id", "index"].find(
        (key) => key in (row || {})
      )
      if (idKey) fields.id = row[idKey]
      return fields
    },
    [a.report_list_schema]
  )

  useEffect(() => {
    if (initialEmitDoneRef.current) return
    if (a.auto_emit_initial === false) return
    const idx = activeIndex
    const rows = a.report_list?.records || []
    if (idx != null && rows && rows[idx]) {
      initialEmitDoneRef.current = true
      lastSentReportIndexRef.current = idx
      const row = rows[idx]
      const fields = buildFields(row)
      send({ type: "report_selected", rowIndex: idx, row, fields })
    }
  }, [activeIndex, a.report_list, a.auto_emit_initial, buildFields, send])

  useEffect(() => {
    setSelectedIndex(null)
  }, [activeIndex])

  const { ref: listWrapRef, style: listCollapseStyle } = useCollapsible(
    !reportListCollapsed,
    280
  )

  const notes = useMemo(
    () => normalizeAlarmNotes(a.report_detail_alarm_note, s),
    [a.report_detail_alarm_note, s]
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
              onClick={() => setReportListCollapsed((value) => !value)}
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
            {reportListCollapsed ? (
              <CompactSelectedReport
                record={
                  (activeIndex != null
                    ? a.report_list?.records?.[activeIndex]
                    : undefined) as any
                }
                schema={a.report_list_schema}
                accent={accent}
                onClick={() => setReportListCollapsed(false)}
              />
            ) : (
              <div ref={listWrapRef} style={listCollapseStyle}>
                <ReportListView
                  data={a.report_list}
                  schema={a.report_list_schema}
                  accent={accent}
                  activeIndex={activeIndex}
                  showHeader={false}
                  listMaxHeight={a.list_max_height ?? null}
                  onSelect={(row, rowIndex) => {
                    setSelectedIndex(null)
                    setLocalReportIndex(rowIndex)
                    const fields = buildFields(row)
                    if (lastSentReportIndexRef.current !== rowIndex) {
                      lastSentReportIndexRef.current = rowIndex
                      send({
                        type: "report_selected",
                        rowIndex,
                        row,
                        fields,
                      })
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

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
                      await navigator.clipboard.writeText(text)
                    } catch {
                      const el = document.createElement("textarea")
                      el.value = text
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand("copy")
                      document.body.removeChild(el)
                    }
                    if (a.emit_copy_events) {
                      send({ type: "copied", target: "detail_log" })
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
            </div>
          </div>
          <div style={s.panel}>
            <DetailLogPanel
              data={selectedDetailData}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              maxHeight={a.detail_max_height ?? undefined}
              minHeight={a.detail_min_height ?? undefined}
            />
          </div>
        </div>

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
                    if (a.emit_copy_events) {
                      send({ type: "copied", target: "report_detail" })
                    }
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
            {notes.length > 0 && (
              <div style={s.notesWrap}>
                {notes.map((note, index) => (
                  <span key={`report-note-${index}`} style={note.style}>
                    {note.level === "error" ? (
                      <IconError size={14} />
                    ) : note.level === "warn" ? (
                      <IconWarn size={14} />
                    ) : (
                      <IconInfo size={14} />
                    )}
                    <span>{note.text}</span>
                  </span>
                ))}
              </div>
            )}

            <HtmlPanel
              title="Report Detail"
              html={reportHtml || undefined}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              maxHeight={a.html_max_height ?? (reportListCollapsed ? 640 : 480)}
            />
          </div>
        </div>

        <div style={s.itemWrap}>
          <div style={s.headerRow}>
            <div style={s.headerOuter}>Error Log (Short)</div>
            <div style={s.headerSpacer} />
          </div>
          <div style={s.panel}>
            <ShortLogView
              key={`short-${activeIndex ?? "none"}`}
              data={shortData}
              filterConfig={a.filter_config}
              searchConfig={a.search_config}
              accent={accent}
              loading={isLoadingReport}
              showHeader={false}
              styleRules={a.shortlog_style_rules}
              layout={a.shortlog_layout}
              jumpButtons={a.shortlog_jump_buttons}
              alarmNote={a.shortlog_alarm_note}
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
