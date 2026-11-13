import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  FileText,
  LoaderCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { money, compact, dateLabel, pct } from "./api";
import type { Answer, Article, View } from "./types";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={"logo " + (small ? "small" : "")}>
      <span className="logo-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        stocklens<span className="logo-period">.</span>
      </span>
    </div>
  );
}
export function Signal({ view }: { view: View }) {
  return (
    <span className={"signal " + view.toLowerCase()}>
      <i />
      {view}
    </span>
  );
}
export function Change({
  value,
  suffix = "%",
  decimals = 2,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <span className={value >= 0 ? "positive" : "negative"}>
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{" "}
      {Math.abs(value).toFixed(decimals)}
      {suffix}
    </span>
  );
}
export function Spinner({ label = "Loading research…" }: { label?: string }) {
  return (
    <div className="loading-inline" role="status">
      <LoaderCircle size={18} className="spin" />
      {label}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Sparkline({
  values,
  positive = true,
}: {
  values: number[];
  positive?: boolean;
}) {
  const min = Math.min(...values),
    max = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 86},${25 - ((v - min) / (max - min || 1)) * 21}`,
    )
    .join(" ");
  return (
    <svg
      width="88"
      height="28"
      viewBox="0 0 88 28"
      className="sparkline"
      aria-label="Price trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#48795a" : "#b16c60"}
        strokeWidth="1.6"
      />
    </svg>
  );
}
export function PriceChart({
  data,
  kind = "value",
  height = 246,
}: {
  data: Record<string, unknown>[];
  kind?: string;
  height?: number;
}) {
  return (
    <div className="price-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#e6e8e1"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={dateLabel}
            axisLine={false}
            tickLine={false}
            minTickGap={45}
            tick={{
              fill: "#8a9088",
              fontSize: 10,
              fontFamily: "IBM Plex Mono",
            }}
            dy={9}
          />
          <YAxis
            domain={["dataMin - 100", "dataMax + 100"]}
            tickFormatter={compact}
            axisLine={false}
            tickLine={false}
            width={62}
            tickCount={4}
            tick={{
              fill: "#8a9088",
              fontSize: 10,
              fontFamily: "IBM Plex Mono",
            }}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <span>{dateLabel(String(label))}</span>
                  <strong>{money(Number(payload[0].value))}</strong>
                </div>
              ) : null
            }
          />
          <Area
            dataKey={kind}
            stroke="#426d51"
            strokeWidth={2}
            fill="#e3eadd"
            fillOpacity={0.65}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  drawer = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${drawer ? "drawer" : ""} ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            closeRef.current();
        }
      }}
      aria-label={title}
    >
      <div className="dialog-top">
        <span>{title}</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
export function SourceChips({
  ids,
  onSource,
}: {
  ids: string[];
  onSource: (id: string) => void;
}) {
  return (
    <div className="source-chips">
      {ids.map((id) => (
        <button key={id} onClick={() => onSource(id)}>
          <FileText size={11} />
          {id}
        </button>
      ))}
    </div>
  );
}
export function AnswerBlock({
  answer,
  onSource,
}: {
  answer: Answer;
  onSource: (id: string) => void;
}) {
  return (
    <div className="answer-block">
      <div className="answer-label">
        <span className={answer.fallback ? "status-dot amber" : "status-dot"} />
        {answer.fallback
          ? "Prepared response"
          : answer.model || "Research assistant"}
        {answer.insufficient_evidence && <span> · Limited evidence</span>}
      </div>
      <div className="answer-prose">
        {answer.answer
          .split("\n")
          .filter(Boolean)
          .map((p, i) => (
            <p key={i}>{p.replace(/\*\*/g, "")}</p>
          ))}
      </div>
      <SourceChips ids={answer.source_ids} onSource={onSource} />
      {answer.notice && <p className="small muted">{answer.notice}</p>}
    </div>
  );
}
export function NewsRow({
  article,
  onOpen,
  featured = false,
}: {
  article: Article;
  onOpen: () => void;
  featured?: boolean;
}) {
  return (
    <button
      className={`news-row ${featured ? "featured" : ""}`}
      onClick={onOpen}
    >
      <div className="news-meta">
        <span className={`sentiment ${article.sentiment}`}>
          {article.sentiment}
        </span>
        <span>{article.symbols.join(" / ")}</span>
        <span>{dateLabel(article.published_at)}</span>
      </div>
      <h3>{article.headline}</h3>
      {featured && <p>{article.takeaway}</p>}
      <div className="news-bottom">
        <span>
          {article.category} <span className="separator">/</span>{" "}
          {article.publisher || "Demo newsroom"}
        </span>
        <ArrowUpRight size={17} />
      </div>
    </button>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
