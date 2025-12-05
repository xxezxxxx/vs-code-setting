export type TableData = { records?: any[]; columns?: string[] } | null | undefined

export type ReportListSchema = {
  name?: string
  date?: string
  path1?: string
  path2?: string
}

export type FilterConfig = {
  columns?: string[]
  initial?: Record<string, string | string[]>
}

export type SearchConfig = {
  columns?: string[]
  placeholder?: string
  initial?: string
}

export type AlarmNote =
  | { text: string; level?: "info" | "warn" | "error" }
  | string
  | null

export type AlarmNoteProp = AlarmNote | AlarmNote[]

export type UiTheme = {
  accentColor?: string
}

export type StyleRule = {
  column: string
  equals?: (string | number)[]
  includes?: (string | number)[]
  regex?: string
  backgroundColor?: string
  color?: string
  badge?: boolean
}

export type ShortLogLayout = {
  columns: { name: string; width_px?: number; flex?: boolean }[]
}

export type ShortLogJumpButtons = Record<
  string,
  Record<string, string | number | (string | number)[]>
>

export type ReportCacheEntry = {
  detail_html?: string | null
  short?: TableData
  detail?: TableData
}

export type Args = {
  report_list?: TableData
  report_list_schema?: ReportListSchema
  report_detail_html?: string | null
  error_log_short?: TableData
  error_log_detail?: TableData
  shortlog_alarm_note?: AlarmNoteProp
  report_detail_alarm_note?: AlarmNoteProp
  alarmNote?: AlarmNoteProp
  report_cache?: ReportCacheEntry[]
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
  shortlog_layout?: ShortLogLayout | null
  max_width?: number | string | null
  frame_height?: number | null
  list_max_height?: number | null
  list_min_height?: number | null
  detail_max_height?: number | null
  detail_min_height?: number | null
  html_max_height?: number | null
  html_min_height?: number | null
  shortlog_jump_buttons?: ShortLogJumpButtons | null
}

export type EventShape =
  | { type: "init" }
  | { type: "report_selected"; rowIndex: number; row: any; fields?: any }
  | { type: "shortlog_row_selected"; rowIndex: number; row: any }
  | ({ type: "copied"; target: "report_detail" | "detail_log" } & {
      event_id?: number
    })

