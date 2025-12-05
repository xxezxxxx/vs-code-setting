import { createStyles } from "../styles"

type Props = {
  title: string
  html?: string | null
  accent: string
  loading?: boolean
  showHeader?: boolean
  maxHeight?: number | null
  minHeight?: number | null
}

export default function HtmlPanel({
  title,
  html,
  accent,
  loading,
  showHeader = true,
  maxHeight,
  minHeight,
}: Props) {
  const s = createStyles(accent)

  return (
    <div>
      {showHeader && <div style={s.header}>{title}</div>}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: 10,
          overflow: "auto",
          maxHeight: maxHeight ?? 444,
          minHeight: minHeight ?? 444,
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
