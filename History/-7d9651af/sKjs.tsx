import { createStyles } from "../styles"
import type { TableData } from "../types"
import { stringifyDetail } from "../utils"

type Props = {
  data?: TableData
  accent: string
  loading?: boolean
  showHeader?: boolean
  maxHeight?: number | null
  minHeight?: number | null
}

export default function DetailLogPanel({
  data,
  accent,
  loading,
  showHeader = true,
  maxHeight,
  minHeight,
}: Props) {
  const s = createStyles(accent)
  const rows = data?.records || []
  const columns = data?.columns || []
  const content = rows.length ? stringifyDetail(rows[0], columns) : ""

  return (
    <div>
      {showHeader && <div style={s.header}>Full Log (Detail)</div>}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: 10,
          overflow: "auto",
          maxHeight: maxHeight ?? 200,
          minHeight: minHeight ?? 200,
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
