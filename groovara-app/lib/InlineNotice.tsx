"use client";

type Props = {
  kind?: "error" | "info";
  title?: string;
  message: string;
};

export default function InlineNotice({ kind = "info", title, message }: Props) {
  const base =
    "rounded-xl border px-4 py-3 text-sm backdrop-blur-md";
  const styles =
    kind === "error"
      ? "border-red-400/20 bg-red-500/10 text-red-200"
      : "border-white/10 bg-white/5 text-white/70";

  return (
    <div className={`${base} ${styles}`}>
      {title && <div className="mb-1 font-medium text-white/90">{title}</div>}
      <div>{message}</div>
    </div>
  );
}
