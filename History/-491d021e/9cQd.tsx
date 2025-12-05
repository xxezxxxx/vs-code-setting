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

// ✅ 커스텀 아이콘
import { CiSaveDown2 } from "react-icons/ci";
import { MdDownloadDone, MdSmsFailed } from "react-icons/md";

/** ===== Args 타입 ===== */
type SaveApi = {
  url: string;
  method?: string;                         // default: POST
  headers?: Record<string, string>;
  timeoutMs?: number;                      // default: 5000
  okCodes?: number[];                      // default: [200,201,204]
  successPath?: string;                    // default: "ok"
  bodyTemplate?: Record<string, any>;      // 템플릿(아래 resolve 참고)
  query?: Record<string, string>;          // ?a=1&b=2
};

type RawArgs = {
  title?: string;
  name?: string;
  order?: string[];
  checked?: string[];
  required?: string[];
  options?: Record<string, string>;
  alarm_note?: string;
  listHeight?: number;
  frameHeight?: number;
  ack?: { save_ok?: boolean; ts?: number } | null;
  saveApi?: SaveApi | null;                // ← UI에서 직접 저장 호출 설정
};

type ReturnPayload = {
  event: "save" | "close";
  name?: string;
  checked: string[];
  order: string[];
  options: Record<string, string>;
  ts: number;
};

/** ===== 유틸: dot path 로 값 꺼내기 ===== */
function getByPath(obj: any, path: string): any {
  try {
    return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  } catch {
    return undefined;
  }
}

/** ===== 유틸: 바디 템플릿 치환 ("$name" 등 키워드) ===== */
function resolveTemplate(tpl: any, ctx: Record<string, any>): any {
  if (tpl == null) return tpl;
  if (typeof tpl === "string" && tpl.startsWith("$")) return ctx[tpl.slice(1)];
  if (Array.isArray(tpl)) return tpl.map((v) => resolveTemplate(v, ctx));
  if (typeof tpl === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(tpl)) out[k] = resolveTemplate(v, ctx);
    return out;
  }
  return tpl;
}

/** ===== props → args 정규화 (중첩/키 변형 모두 흡수) ===== */
function normalizeArgs(props: ComponentProps): RawArgs {
  let a: any = (props as any)?.args ?? {};
  if (a?.args && typeof a.args === "object") a = a.args;
  if (a?.data && typeof a.data === "object") a = a.data;
  if (!a.order && (props as any)?.order) a = props;

  const safeArr = (v: any) => (Array.isArray(v) ? v : []);
  const safeObj = (o: any) => (o && typeof o === "object" ? o : {});

  return {
    title: a?.title,
    name: a?.name,
    order: safeArr(a?.order).filter(Boolean),
    checked: safeArr(a?.checked).filter(Boolean),
    required: safeArr(a?.required).filter(Boolean),
    options: safeObj(a?.options),
    alarm_note: a?.alarm_note,
    listHeight: typeof a?.listHeight === "number" ? a.listHeight : undefined,
    frameHeight: typeof a?.frameHeight === "number" ? a.frameHeight : undefined,
    ack: a?.ack ?? null,
    saveApi: a?.saveApi ?? null,
  };
}

/** ===== Sortable Row ===== */
const Row: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (id: string, next: boolean) => void;
}> = ({ id, label, checked, disabled, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

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
    opacity: disabled ? 0.85 : 1,
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
  const args = normalizeArgs(props);

  // 안전한 높이 제한
  const frameHeight = Math.max(300, Math.min(3000, args.frameHeight ?? 720));
  const listHeight = Math.max(120, Math.min(1200, args.listHeight ?? 360));

  // 초기 상태
  const initialOrder = useMemo(() => (args.order ?? []).filter(Boolean), [
    JSON.stringify(args.order ?? []),
  ]);

  const requiredSet = useMemo(
    () => new Set((args.required ?? []).filter(Boolean)),
    [JSON.stringify(args.required ?? [])]
  );

  // required는 항상 checked에 포함
  const initialChecked = useMemo(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    return Array.from(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [checkedSet, setCheckedSet] = useState<Set<string>>(
    new Set(initialChecked)
  );

  useEffect(() => {
    Streamlit.setComponentReady();
    Streamlit.setFrameHeight(frameHeight);
  }, [frameHeight, order.length]);

  // 외부 prop 동기화
  useEffect(() => setOrder(initialOrder), [initialOrder.join("|")]);
  useEffect(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    setCheckedSet(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  // 렌더 순서: 체크한 것들 위로, 나머지 아래
  const itemsToRender = useMemo(() => {
    const checked = order.filter((id) => checkedSet.has(id));
    const unchecked = order.filter((id) => !checkedSet.has(id));
    return [...checked, ...unchecked];
  }, [order, checkedSet]);

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
      setOrder(arrayMove(src, oldIndex, newIndex));
    },
    [itemsToRender]
  );

  // 체크 토글 (required는 해제 불가), 경계 배치
  const onToggle = useCallback(
    (id: string, next: boolean) => {
      if (requiredSet.has(id)) return;

      setCheckedSet((prev) => {
        const nextSet = new Set(prev);
        if (next) nextSet.add(id);
        else nextSet.delete(id);

        const nextCheckedCount = nextSet.size;
        setOrder((prevOrder) => {
          const checked = prevOrder.filter((x) => nextSet.has(x));
          const unchecked = prevOrder.filter((x) => !nextSet.has(x));
          const grouped = [...checked, ...unchecked];

          // 체크됨 → 체크 그룹 끝 / 해제 → 체크 그룹 바로 아래(언체크 맨 앞)
          const idx = next ? Math.max(0, nextCheckedCount - 1) : nextCheckedCount;
          const at = grouped.indexOf(id);
          if (at < 0) return grouped;
          const arr = grouped.slice();
          arr.splice(at, 1);
          arr.splice(idx, 0, id);
          return arr;
        });

        return nextSet;
      });
    },
    [requiredSet]
  );

  /** ================= 저장 호출 (FastAPI) ================= */
  const saveToApi = useCallback(
    async (payload: ReturnPayload) => {
      const cfg = args.saveApi;
      if (!cfg?.url)
        return { ok: false, status: 0, data: null, error: "No saveApi.url" };

      // 쿼리스트링
      const query = cfg.query ? "?" + new URLSearchParams(cfg.query).toString() : "";
      const url = cfg.url + query;

      // 템플릿 치환 컨텍스트
      const ctx = {
        name: payload.name,
        checked: payload.checked,
        order: payload.order,
        options: payload.options,
        ts: payload.ts,
        // 필요 시 파이썬에서 내려준 user_id 등을 props로 받을 수 있음
        user_id: (props as any)?.args?.user_id ?? undefined,
      };
      const body = resolveTemplate(cfg.bodyTemplate ?? {}, ctx);

      const method = (cfg.method ?? "POST").toUpperCase();
      const headers = { "Content-Type": "application/json", ...(cfg.headers ?? {}) };
      const timeoutMs = cfg.timeoutMs ?? 5000;
      const okCodes = cfg.okCodes ?? [200, 201, 204];
      const successPath = cfg.successPath ?? "ok";

      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: method === "GET" ? undefined : JSON.stringify(body),
          signal: ac.signal,
        });
        clearTimeout(t);

        const status = res.status;
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          /* non-json */
        }

        const httpOk = okCodes.includes(status);
        const bizOk = successPath ? !!getByPath(data, successPath) : true;
        return { ok: httpOk && bizOk, status, data, error: null };
      } catch (e: any) {
        clearTimeout(t);
        return { ok: false, status: 0, data: null, error: e?.message || String(e) };
      }
    },
    [args.saveApi, props]
  );

  /** ================= 이벤트 전송 ================= */
  const send = useCallback(
    async (event: "save" | "close") => {
      const payload: ReturnPayload = {
        event,
        name: args.name,
        checked: Array.from(checkedSet),
        order: itemsToRender,
        options: args.options ?? {},
        ts: Date.now(),
      };

      if (event === "save" && args.saveApi?.url) {
        // ⏳ 저장중 토스트 (아이콘 교체, ProgressBar 없음)
        const id = "saving";
        toast.info("저장 중...", {
          toastId: id,
          autoClose: false,          // 성공/실패에서 update로 닫음
          icon: <CiSaveDown2 size={20} />, // ✅ 커스텀 아이콘
        });

        const result = await saveToApi(payload);

        if (result.ok) {
          toast.update(id, {
            render: "저장 완료 !",
            type: "success",
            autoClose: 2000,
            icon: <MdDownloadDone size={20} />, // ✅ 성공 아이콘
          });
        } else {
          const msg = result.error || `저장 실패 (status: ${result.status})`;
          toast.update(id, {
            render: msg,
            type: "error",
            autoClose: 3000,
            icon: <MdSmsFailed size={20} />, // ✅ 실패 아이콘
          });
        }

        // 필요 시 Streamlit에도 값 반환
        Streamlit.setComponentValue(payload);
        return;
      }

      // saveApi 미사용 시: 기존처럼 Streamlit에만 반환
      Streamlit.setComponentValue(payload);
    },
    [args.name, args.options, args.saveApi, checkedSet, itemsToRender, saveToApi]
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
            <SortableContext items={itemsToRender} strategy={verticalListSortingStrategy}>
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

      {/* ✅ 기본 아이콘 제거 + ProgressBar(타이머바) 제거 */}
      <ToastContainer
        position="top-right"
        icon={false}          // 기본 아이콘 제거
        hideProgressBar       // 진행바(시간 초처럼 보이는 바) 제거
        closeButton={false}   // (선택) X 버튼 제거. 필요하면 true로
        newestOnTop
        draggable={false}
        pauseOnFocusLoss={false}
      />
    </div>
  );
};

export default withStreamlitConnection(MyComponent);
