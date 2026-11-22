export function element<T extends Element = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`#${CSS.escape(id)}`);
  if (!node) throw new Error(`Missing interface element: #${id}`);
  return node;
}
export function text(node: Element, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}
const smallNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const largeNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  notation: "compact",
});
export function format(value: number): string {
  return value >= 10000 ? largeNumber.format(value) : smallNumber.format(value);
}

const wholeNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
export const formatWhole = (value: number): string => wholeNumber.format(value);
