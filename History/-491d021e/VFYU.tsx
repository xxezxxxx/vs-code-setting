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

/** ===== Args ===== */
type SaveApi = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  okCodes?: number[];
  successPath?: string;
  bodyTemplate?: Record<string, any>;
  query?: Record<string, string>;
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
  saveApi?: SaveApi | null;
};

type ReturnPayload = {
  event: "save" | "close";
  name?: string;
  checked: string[];
  order: string[];
  options: Record<string, string>;
  ts: number;
};

/** ===== dot path util ===== */
function getByPath(obj: any, path: string): any {
  try {
    return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  } catch {
    return undefined;
  }
}

/** ===== 템플릿 치환 ===== */
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

/** ===== args normalize ===== */
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

/** ===== Row ===== */
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
      <span {...attributes} {...listeners} title="드래그해서 순서 변경"
        style={{ cursor: "grab", fontSize: 16, opacity: 0.7, width: 18, textAlign: "center" }}>☰</span>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onToggle(id, e.target.checked)} style={{ marginRight: 4 }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
};

const MyComponent: React.FC<ComponentProps> = (props) => {
  const args = normalizeArgs(props);
  const frameHeight = Math.max(300, Math.min(3000, args.frameHeight ?? 720));
  const listHeight = Math.max(120, Math.min(1200, args.listHeight ?? 360));

  const initialOrder = useMemo(() => (args.order ?? []).filter(Boolean), [JSON.stringify(args.order ?? [])]);
  const requiredSet = useMemo(() => new Set((args.required ?? []).filter(Boolean)), [JSON.stringify(args.required ?? [])]);
  const initialChecked = useMemo(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    return Array.from(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [checkedSet, setCheckedSet] = useState<Set<string>>(new Set(initialChecked));

  useEffect(() => { Streamlit.setComponentReady(); Streamlit.setFrameHeight(frameHeight); },
    [frameHeight, order.length]);

  useEffect(() => setOrder(initialOrder), [initialOrder.join("|")]);
  useEffect(() => {
    const base = new Set(args.checked ?? []);
    requiredSet.forEach((id) => base.add(id));
    setCheckedSet(base);
  }, [JSON.stringify(args.checked ?? []), requiredSet]);

  const itemsToRender = useMemo(() => {
    const checked = order.filter((id) => checkedSet.has(id));
    const unchecked = order.filter((id) => !checkedSet.has(id));
    return [...checked, ...unchecked];
  }, [order, checkedSet]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const src = itemsToRender;
    const oldIndex = src.indexOf(String(active.id));
    const newIndex = src.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(src, oldIndex, newIndex));
  }, [itemsToRender]);

  const onToggle = useCallback((id: string, next: boolean) => {
    if (requiredSet.has(id)) return;
    setCheckedSet((prev) => {
      const nextSet = new Set(prev);
      if (next) nextSet.add(id); else nextSet.delete(id);
      const nextCount = nextSet.size;
      setOrder((prevOrder) => {
        const checked = prevOrder.filter((x) => nextSet.has(x));
        const unchecked = prevOrder.filter((x) => !nextSet.has(x));
        const grouped = [...checked, ...unchecked];
        const idx = next ? Math.max(0, nextCount - 1) : nextCount;
        const at = grouped.indexOf(id);
        if (at < 0) return grouped;
        const arr = grouped.slice();
        arr.splice(at, 1);
        arr.splice(idx, 0, id);
        return arr;
      });
      return nextSet;
    });
  }, [requiredSet]);

/** 공용: 에러 응답 안전 파서 (JSON/텍스트 가리지 않고 파싱) */
async function parseResponseSafely(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      // 서버가 text로 에러를 준 경우도 표준화
      data = text ? { detail: text } : null;
    }
  } catch {
    // 본문이 비어있거나 파싱 실패 → data=null 유지
  }

  // 표준화된 형태로 리턴
  return {
    status: res.status,
    data,
    code: data?.code ?? null,
    detail:
      data?.detail ??
      data?.message ??
      data?.error ??
      (res.ok ? null : `HTTP ${res.status} ${res.statusText}`),
    retryAfter: Number(res.headers.get("retry-after") || 0) || null,
    contentType,
  };
}

/** ================= 저장 호출 (FastAPI) ================= */
const saveToApi = useCallback(
  async (payload: ReturnPayload) => {
    const cfg = args.saveApi;
    if (!cfg?.url) return { ok: false, status: 0, data: null, error: "No saveApi.url" };

    const query = cfg.query ? "?" + new URLSearchParams(cfg.query).toString() : "";
    const url = cfg.url + query;
    const ctx = {
      name: payload.name,
      checked: payload.checked,
      order: payload.order,
      options: payload.options,
      ts: payload.ts,
    };
    const body = resolveTemplate(cfg.bodyTemplate ?? {}, ctx);
    const method = (cfg.method ?? "POST").toUpperCase();
    const headers = { "Content-Type": "application/json", ...(cfg.headers ?? {}) };

    // 네트워크/무한대기 방지: 8초 타임아웃 + AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // keepalive: true, // 필요 시 활성화
      });

      clearTimeout(timeoutId);

      const parsed = await parseResponseSafely(res);

      // HTTP OK 판단(커스터마이즈 가능)
      const httpOk = (cfg.okCodes ?? [200, 201, 204]).includes(parsed.status);

      // 비즈니스 OK 판단(successPath 제공 시)
      const bizOk = cfg.successPath ? !!getByPath(parsed.data, cfg.successPath) : true;

      // 에러 메시지 구성(429 같은 표준 에러를 code/detail로 명확히)
      const errorMsg = httpOk && bizOk
        ? null
        : [
            parsed.code ? `code: ${parsed.code}` : null,
            parsed.detail ? `detail: ${parsed.detail}` : null,
            parsed.retryAfter ? `retryAfter: ${parsed.retryAfter}s` : null,
          ]
            .filter(Boolean)
            .join(" | ") || `HTTP ${parsed.status}`;

      return { ok: httpOk && bizOk, status: parsed.status, data: parsed.data, error: errorMsg };
    } catch (e: any) {
      clearTimeout(timeoutId);
      // 여기로 오면 브라우저 측 네트워크/보안(CORS, mixed content), 타임아웃, abort 등
      // e.name === 'AbortError' 도 구분 가능
      const msg =
        e?.name === "AbortError"
          ? "네트워크 타임아웃(요청이 너무 오래 걸립니다)"
          : e?.message || String(e);
      return { ok: false, status: 0, data: null, error: msg };
    }
  },
  [args.saveApi]
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
        const id = "saving";

        // ⏳ 저장중 (파랑)
        toast.info("저장하고 있어요 ..", {
          toastId: id,
          autoClose: false,
          icon: <CiSaveDown2 size={28} />,
          style: { color: "blue", fontSize: "14px" },
        });

        const result = await saveToApi(payload);

        if (result.ok) {
          toast.update(id, {
            render: "저장 성공 !",
            type: "success",
            autoClose: 2000,
            icon: <MdDownloadDone size={28} />,
            style: { color: "green", fontSize: "14px" },
          });
        } else {
          // ⚠️ 에러 메시지 구성(HTTP 상태+code+detail 우선, 아니면 Failed to fetch/timeout 원인)
          const parts = [];
          if (result.status) parts.push(`status: ${result.status}`);
          if (result.error) parts.push(result.error);
          const msg = parts.join(" | ") || "요청 실패";

          toast.update(id, {
            render: msg,
            type: "error",
            autoClose: 4000,
            icon: <MdSmsFailed size={28} />,
            style: { color: "red", fontSize: "14px", whiteSpace: "pre-wrap" },
          });
        }

        Streamlit.setComponentValue(payload);
        return;
      }

      Streamlit.setComponentValue(payload);
    },
    [args.name, args.options, args.saveApi, checkedSet, itemsToRender, saveToApi]
  );


  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fafafa", fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",Arial,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"', height: "100%" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee", background: "#fff", fontWeight: 600 }}>
        {args.title ?? "Columns"}
      </div>

      <div style={{ height: listHeight, overflowY: "auto", background: "#fff" }}>
        {itemsToRender.length === 0 ? (
          <div style={{ padding: 16, color: "#666" }}>No items to show</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={itemsToRender} strategy={verticalListSortingStrategy}>
              {itemsToRender.map((col) => (
                <Row key={col} id={col} label={col} checked={checkedSet.has(col)} disabled={requiredSet.has(col)} onToggle={onToggle} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderTop: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }} title={args.alarm_note ?? ""}>
          ⚠️ {args.alarm_note ?? ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => send("close")} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}>Close</button>
          <button onClick={() => send("save")} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #4F8DFD", background: "#4F8DFD", color: "#fff", cursor: "pointer" }}>Save</button>
        </div>
      </div>

      <ToastContainer position="top-right" icon={false} hideProgressBar closeButton={false} newestOnTop draggable={false} pauseOnFocusLoss={false} />
    </div>
  );
};

export default withStreamlitConnection(MyComponent);
