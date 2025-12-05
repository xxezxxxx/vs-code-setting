import { useState } from "react"

import { createStyles } from "../styles"
import type { ReportListSchema, TableData } from "../types"

type Props = {
  data?: TableData
  schema?: ReportListSchema
  onSelect: (row: any, index: number) => void
  accent: string
  activeIndex?: number | null
  showHeader?: boolean
  listMaxHeight?: number | null
  listMinHeight?: number | null
}

export default function ReportListView({
  data,
  schema,
  onSelect,
  accent,
  activeIndex,
  showHeader = true,
  listMaxHeight,
  listMinHeight,
}: Props) {
  const s = createStyles(accent)
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
          minHeight: listMinHeight ?? (s.listScroll.minHeight as number),
        }}
      >
        {records.length === 0 && (
          <div style={{ opacity: 0.7, fontSize: 12 }}>No reports</div>
        )}
        {records.map((row, index) => {
          const isActive = (activeIndex ?? localActive) === index
          return (
            <div
              key={index}
              style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}
              onClick={() => {
                setLocalActive(index)
                onSelect(row, index)
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
                    {String(row?.[nameKey] ?? "(no name)")}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#555",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={String(row?.[path2Key] ?? "")}
                  >
                    {String(row?.[path2Key] ?? "")}
                  </div>
                </div>
                <div
                  style={{ opacity: 0.8, fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {String(row?.[dateKey] ?? "")}
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
                <span title={String(row?.[path1Key] ?? "")}>
                  {String(row?.[path1Key] ?? "")}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
