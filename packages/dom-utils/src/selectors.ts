export function escapeCssIdentifier(value: string): string {
  const nativeEscape = globalThis.CSS?.escape;
  if (nativeEscape) return nativeEscape(value);

  return Array.from(value)
    .map((char, index) => {
      const codePoint = char.codePointAt(0) ?? 0;
      const isLetter = /[a-zA-Z]/.test(char);
      const isDigit = /[0-9]/.test(char);
      const isSafe = isLetter || isDigit || char === "_" || char === "-";

      if (codePoint === 0) return "\uFFFD";
      if ((codePoint >= 1 && codePoint <= 31) || codePoint === 127) return `\\${codePoint.toString(16)} `;
      if (index === 0 && isDigit) return `\\${codePoint.toString(16)} `;
      if (index === 1 && isDigit && value[0] === "-") return `\\${codePoint.toString(16)} `;
      if (index === 0 && char === "-" && value.length === 1) return "\\-";
      if (isSafe) return char;
      return `\\${char}`;
    })
    .join("");
}
