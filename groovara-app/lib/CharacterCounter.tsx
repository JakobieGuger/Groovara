type CharacterCounterProps = {
  value: string;
  max: number;
};

export default function CharacterCounter({
  value,
  max,
}: CharacterCounterProps) {
  const count = value.length;
  const nearLimit = count >= max * 0.9;
  const overLimit = count > max;

  return (
    <p
      className={`mt-1 text-right text-xs ${
        overLimit
          ? "text-red-400"
          : nearLimit
            ? "text-yellow-500"
            : "text-muted-foreground"
      }`}
    >
      {count.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}