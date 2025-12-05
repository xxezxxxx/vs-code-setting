import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/** ===== Args ===== */
type RawArgs = {
  title?: string;
  name?: string;
  order?: string[];                // 전체 목록 + 초기 순서
  checked?: string[];              // 미리 체크된 항목
  required?: string[];             // 해제 불가 항목
  options?: Record<string, string>; // 렌더X, 그대로 반환만
  alarm_note?: string;
  listHeight?: number;
  frameHeight?: number;
  ack?: { save_ok?: boolean } | null;
};

/** ===== Return payload ===== */
type ReturnPayload = {
  event: "save" | "close";
  name?: string;
  checked: string[];
  order: string[];
  options: Record<string, string>;
  ts: number;
};

/** ===== Sortable Row ===== */
const Row: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (id: string, next: boolean) => void;
}> = ({ id, label, checked, disabled, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderBottom: "1px solid #eee",
    userSelect: "none",
    background: disabled ? "#f9f9f9" : "#fff",
    opacity: disabled ? 0.8 : 1,
  };

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
        disabled={disabled}
        onChange={(e) => onToggle(id, e.target.checked)}
        style={{ marginRight: 4 }}
      />

      {/* Label */}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </div>
  );
};

const MyComponent: React.FC<ComponentProps> = (props) => {
  const args = (props.args ?? {}) as RawArgs;

  // 높이 설정
  const frameHeight = Math.max(300, Math.min(3000, args.frameHeight ?? 720));
  const listHeight = Math.max(120, Math.min(1200, args.listHeight ?? 360));

  // 초기 상태
  const initialOrder = useMemo(() => (args.order ?? []).filter(Boolean), [
    JSON.stringify(args.order ?? []),
  ]);

  // required는 항상 checked에 포함시킴
  const requiredSet = useMemo(
    () => new Set((args.required ?? []).filter(Boolean)),
    [JSON.stringify(args.required ?? [])]
  );

  const initialChecked = useMemo(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    return Array.from(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [checkedSet, setCheckedSet] = useState<Set<string>>(
    new Set(initialChecked)
  );
  const [lastEvent, setLastEvent] = useState<"save" | "close" | null>(null);

  // 저장 성공 토스트
  useEffect(() => {
    if (args.ack?.save_ok && lastEvent === "save") {
      toast.success("저장 성공 !", { position: "top-right", autoClose: 2000 });
    }
  }, [args.ack?.save_ok, lastEvent]);

  // 외부 prop 동기화 (order/checked/required 변경 대응)
  useEffect(() => setOrder(initialOrder), [initialOrder.join("|")]);
  useEffect(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    setCheckedSet(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  // 프레임 높이 고정
  useEffect(() => {
    Streamlit.setFrameHeight(frameHeight);
    Streamlit.setComponentReady();
  }, [frameHeight]);

  // 렌더 순서: checked 먼저, unchecked 바로 아래
  const itemsToRender = useMemo(() => {
    const checked = order.filter((id) => checkedSet.has(id));
    const unchecked = order.filter((id) => !checkedSet.has(id));
    return [...checked, ...unchecked];
  }, [order, checkedSet]);

  // 유틸: 배열 내 아이템을 특정 위치로 이동
  const moveItemToIndex = useCallback((src: string[], id: string, toIdx: number) => {
    const idx = src.indexOf(id);
    if (idx < 0) return src;
    const arr = src.slice();
    arr.splice(idx, 1);
    arr.splice(Math.max(0, Math.min(toIdx, arr.length)), 0, id);
    return arr;
  }, []);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const src = itemsToRender;
      const oldIndex = src.indexOf(String(active.id));
      const newIndex = src.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const moved = arrayMove(src, oldIndex, newIndex);
      setOrder(moved);
    },
    [itemsToRender]
  );

  // 체크 토글: required는 해제 불가, 경계 위치로 이동
  const onToggle = useCallback(
    (id: string, next: boolean) => {
      if (requiredSet.has(id)) return; // 해제 불가

      setCheckedSet((prev) => {
        const prevSize = prev.size;
        const nextSet = new Set(prev);
        if (next) nextSet.add(id);
        else nextSet.delete(id);

        // 경계 인덱스 계산: 체크된 개수
        const nextCheckedCount = nextSet.size;
        setOrder((prevOrder) => {
          // 현재 렌더 그룹 기준 순서로 정렬한 뒤 이동
          const checked = prevOrder.filter((x) => nextSet.has(x));
          const unchecked = prevOrder.filter((x) => !nextSet.has(x));
          const grouped = [...checked, ...unchecked];

          if (next) {
            // 체크됨 → 체크 그룹의 맨 끝으로
            return moveItemToIndex(grouped, id, nextCheckedCount - 1);
          } else {
            // 체크 해제 → 체크 그룹 바로 아래(언체크 그룹 맨 앞)
            return moveItemToIndex(grouped, id, nextCheckedCount);
          }
        });

        // 불필요 업데이트 방지용(정보)
        void prevSize;
        return nextSet;
      });
    },
    [requiredSet, moveItemToIndex]
  );

  const send = useCallback(
    (event: "save" | "close") => {
      const payload: ReturnPayload = {
        event,
        name: args.name,
        checked: Array.from(checkedSet),
        order: itemsToRender,        // 현재 보이는 순서로 반환
        options: args.options ?? {}, // 그대로 패스스루
        ts: Date.now(),
      };
      setLastEvent(event);
      Streamlit.setComponentValue(payload);
    },
    [args.name, checkedSet, itemsToRender, args.options]
  );

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

      {/* Scrollable list */}
      <div style={{ height: listHeight, overflowY: "auto", background: "#fff" }}>
        {itemsToRender.length === 0 ? (
          <div style={{ padding: 16, color: "#666" }}>No items to show</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={itemsToRender}
              strategy={verticalListSortingStrategy}
            >
              {itemsToRender.map((col) => (
                <Row
                  key={col}
                  id={col}
                  label={col}
                  checked={checkedSet.has(col)}
                  disabled={requiredSet.has(col)}
                  onToggle={onToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer */}
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
  );
};

export default withStreamlitConnection(MyComponent);
