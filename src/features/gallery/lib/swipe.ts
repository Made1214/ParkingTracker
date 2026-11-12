/** Distancia mínima en px para que un arrastre cuente como deslizar. */
export const SWIPE_THRESHOLD = 50;

/**
 * Dirección de un deslizamiento en el visor (plan E9.F2.T1): `1` a la foto
 * siguiente (dedo hacia la izquierda), `-1` a la anterior, `0` si fue un
 * toque o un gesto mayormente vertical.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_THRESHOLD) return 0;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
