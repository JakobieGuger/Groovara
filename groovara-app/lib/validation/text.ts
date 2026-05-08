export function findUnsupportedCharacter(value: string) {
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const code = char.charCodeAt(0);

    const allowedWhitespace =
      char === "\n" ||
      char === "\r" ||
      char === "\t";

    const isControlCharacter = code < 32 && !allowedWhitespace;

    if (isControlCharacter) {
      return {
        index: i,
        code,
      };
    }
  }

  return null;
}

export function validateTextField({
  value,
  label,
  max,
  min = 0,
}: {
  value: string;
  label: string;
  max: number;
  min?: number;
}) {
  const text = value.trim();

  if (text.length < min) {
    return `${label} is too short.`;
  }

  if (value.length > max) {
    return `${label} is too long. Maximum is ${max.toLocaleString()} characters.`;
  }

  const unsupported = findUnsupportedCharacter(value);

  if (unsupported) {
    return `${label} contains an unsupported character near character ${
      unsupported.index + 1
    }.`;
  }

  return null;
}