/** Keep the entire upgraded squad inside the 390-unit battlefield. */
export function droneX(originX: number, count: number, index: number) {
  const spacing = 23;
  const left = Math.max(14, Math.min(376 - (count - 1) * spacing, originX - (count - 1) * spacing / 2));
  return left + index * spacing;
}
