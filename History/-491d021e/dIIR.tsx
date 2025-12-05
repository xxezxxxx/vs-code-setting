import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

/** ===== Args (columns 제거) ===== */
type Args = {
  title?: string
  name?: string
  order?: string[]           // 전체 목록 + 순서
  checked?: string[]         // 미리 체크된 항목
  options?: Record<string, string>
  alarm_note?: string
  listHeight?: number        // 스크롤 영역 높이(px)
  frameHeight?: number       // iframe 고정 높이(px)
  ack?: { save_ok?: boolean } | null
}

type ReturnPayload = {
  event: "save" | "close"
  name?: string
  checked: string[]
  order: string[]
  options: Record<string, string>
  ts: number
}

/** ===== Sortable Row ===== */
const Row: React.FC<{
  id: string
  label: string
  checked: boolean
  onToggle: (id: string, next: boolean) => void
}> = ({ id, label, checked, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderBottom: "1px solid #eee",
    userSelect: "none",
    background: "#fff",
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        title="드래그해서 순서 변경"
        style={{
          cursor: "grab",
          fontSize: 16,
          opacity: 0.7,
          width: 18,
          textAlign: "center",
        }}
      >
        ☰
      </span>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(id, e.target.checked)}
        style={{ marginRight: 4 }}
      />

      {/* Label */}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </div>
  )
}

/** ===== Main Component ===== */
const MyComponent: React.FC<ComponentProps> = (props) => {
  const args = props.args as Args

  // 높이 설정
  const frameHeight = Math.max(300, Math.min(3000, args.frameHeight ?? 720))
  const listHeight  = Math.max(120, Math.min(1200, args.listHeight ?? 360))

  // 초기 상태 (order 비면 checked 사용 → 그래도 없으면 빈 배열)
  const initialOrder = useMemo(() => {
    const o = (args.order ?? []).filter(Boolean)
    if (o.length > 0) return o
    const c = (args.checked ?? []).filter(Boolean)
    if (c.length > 0) return c
    return []
  }, [JSON.stringify(args.order ?? []), JSON.stringify(args.checked ?? [])])

  const [order, setOrder] = useState<string[]>(initialOrder)
  const [checkedSet, setCheckedSet] = useState<Set<string>>(new Set(args.checked ?? []))
  const [options, setOptions] = useState<Record<string, string>>(args.options ?? {})
  const [lastEvent, setLastEvent] = useState<"save" | "close" | null>(null)

  // 저장 성공 토스트
  useEffect(() => {
    if (args.ack?.save_ok && lastEvent === "save") {
      toast.success("저장 성공 !", { position: "top-right", autoClose: 2000 })
    }
  }, [args.ack?.save_ok, lastEvent])

  // 외부 prop 동기화
  useEffect(() => setOrder(initialOrder), [initialOrder.join("|")])
  useEffect(() => setCheckedSet(new Set(args.checked ?? [])), [JSON.stringify(args.checked ?? [])])
  useEffect(() => setOptions(args.options ?? {}), [JSON.stringify(args.options ?? {})])

  // 프레임 고정 높이
  useEffect(() => {
    Streamlit.setFrameHeight(frameHeight)
    Streamlit.setComponentReady()
  }, [frameHeight])

  // 렌더에 사용할 목록 (state 비면 args.order로 폴백)
  const itemsToRender = order.length ? order : (args.order ?? []).filter(Boolean)

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // 렌더 배열 기준으로 이동 계산
    const src = itemsToRender
    const oldIndex = src.indexOf(String(active.id))
    const newIndex = src.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const moved = arrayMove(src, oldIndex, newIndex)
    setOrder(moved) // 이후부터는 state 기반
  }, [itemsToRender])

  const onToggle = useCallback((id: string, next: boolean) => {
    setCheckedSet((prev) => {
      const s = new Set(prev)
      if (next) s.add(id); else s.delete(id)
      return s
    })
  }, [])

  const send = useCallback((event: "save" | "close") => {
    const payload: ReturnPayload = {
      event,
      name: args.name,
      checked: Array.from(checkedSet),
      order: itemsToRender,   // 현재 화면 순서로 반환
      options,
      ts: Date.now(),
    }
    setLastEvent(event)
    Streamlit.setComponentValue(payload)
  }, [args.name, checkedSet, itemsToRender, options])

  const optionRows = Object.entries(options)
  const setOptionValue = (k: string, v: string) =>
    setOptions((prev) => ({ ...prev, [k]: v }))

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fafafa",
        fontFamily:
          '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",Arial,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #eee",
          background: "#fff",
          fontWeight: 600,
        }}
      >
        {args.title ?? "Columns"}
      </div>

      {/* Scrollable list area */}
      <div style={{ height: listHeight, overflowY: "auto", background: "#fff" }}>
        {itemsToRender.length === 0 ? (
          <div style={{ padding: 16, color: "#666" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No items to show</div>
            <div style={{ fontSize: 12 }}>order/checked 모두 비어 있습니다.</div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={itemsToRender} strategy={verticalListSortingStrategy}>
              {itemsToRender.map((col) => (
                <Row
                  key={col}
                  id={col}
                  label={col}
                  checked={checkedSet.has(col)}
                  onToggle={onToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Options editor */}
        {optionRows.length > 0 && (
          <div style={{ padding: "10px 12px", borderTop: "1px dashed #eee" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Options</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {optionRows.map(([k, v]) => (
                <React.Fragment key={k}>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: "28px",
                      paddingLeft: 4,
                      color: "#555",
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: 8,
                    }}
                    title={k}
                  >
                    {k}
                  </div>
                  <input
                    value={v}
                    onChange={(e) => setOptionValue(k, e.target.value)}
                    style={{
                      height: 28,
                      padding: "0 8px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      outline: "none",
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          borderTop: "1px solid #eee",
          background: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#666",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "60%",
          }}
          title={args.alarm_note ?? ""}
        >
          {args.alarm_note ?? ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => send("close")}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
            }}
            title="변경값 반환 + 닫기 이벤트"
          >
            Close
          </button>
          <button
            onClick={() => send("save")}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #4F8DFD",
              background: "#4F8DFD",
              color: "#fff",
              cursor: "pointer",
            }}
            title="현재 값 반환 + 저장 이벤트"
          >
            Save
          </button>
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}

export default withStreamlitConnection(MyComponent)
