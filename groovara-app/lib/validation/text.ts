export function findUnsupportedCharacter(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    // Allow tab, line feed, carriage return.
    if (code === 9 || code === 10 || code === 13) {
      continue;
    }

    // Block C0 control characters and DEL.
    if (code < 32 || code === 127) {
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

export function normalizeUserText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}