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
      ? "border-red-700/25 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-200"
      : "border-border bg-card/70 text-muted-foreground";

  return (
    <div className={`${base} ${styles}`}>
      {title && <div className="mb-1 font-medium text-foreground">{title}</div>}
      <div>{message}</div>
    </div>
  );
}
