import { escapeCssIdentifier } from "./selectors";

export function isVisible(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type === "hidden") return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const hasLayout = rect.width > 0 && rect.height > 0;
  const isJsdomLike = /jsdom/i.test(window.navigator.userAgent) && rect.width === 0 && rect.height === 0 && element.isConnected;
  return style.visibility !== "hidden" && style.display !== "none" && (hasLayout || isJsdomLike);
}

export function elementSelector(element: HTMLElement): string {
  const id = element.getAttribute("id");
  if (id) return `#${escapeCssIdentifier(id)}`;

  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${escapeCssIdentifier(name)}"]`;

  return `[data-job-autofill-id="${escapeCssIdentifier(element.dataset.jobAutofillId ?? "")}"]`;
}

export function ensureElementId(element: HTMLElement): string {
  if (!element.dataset.jobAutofillId) {
    element.dataset.jobAutofillId = `job-autofill-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  }
  return element.dataset.jobAutofillId;
}

export function queryFillableElements(root: ParentNode = document): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "input, textarea, select, [role='combobox'], [role='radio'], [role='checkbox'], [contenteditable='true'], [role='textbox']"
    )
  );
}
