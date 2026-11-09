"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
const NUMBER = /\d+(?:\.\d+)?/g;

/** Nodos de texto con cifras dentro de un elemento, sin tocar su estructura. */
function numericTextNodes(element: Element, firstOnly: boolean) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!/\d/.test(node.data)) continue;
    nodes.push(node);
    if (firstOnly) break;
  }
  return nodes;
}

/**
 * Anima al montar lo que sus descendientes marcan con atributos, para que
 * las pantallas de servidor no tengan que volverse componentes cliente:
 *
 * - `data-count`: las cifras del texto cuentan desde cero hasta su valor
 *   (`data-count="first"` anima solo la primera, p. ej. el 3 de "3/5").
 * - `data-grow="x" | "y"`: la barra crece desde cero a lo ancho o a lo alto.
 *
 * El HTML del servidor ya trae los valores finales; sin JavaScript o con
 * "reducir movimiento" activado se ven tal cual, sin animación.
 */
export function Motion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // Un <Motion> anidado anima lo suyo; aquí solo lo que es de este.
      const own = (selector: string) =>
        [...root.querySelectorAll(selector)].filter(
          (element) => element.closest("[data-motion]") === root,
        );
      const restore: (() => void)[] = [];
      for (const element of own("[data-count]")) {
        const firstOnly = element.getAttribute("data-count") === "first";
        for (const node of numericTextNodes(element, firstOnly)) {
          const original = node.data;
          restore.push(() => {
            node.data = original;
          });
          const progress = { value: 0 };
          const render = () => {
            node.data = original.replace(NUMBER, (match) =>
              (Number(match) * progress.value).toFixed(
                match.split(".")[1]?.length ?? 0,
              ),
            );
          };
          render();
          gsap.to(progress, {
            value: 1,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: render,
            onComplete: () => {
              node.data = original;
            },
          });
        }
      }
      const horizontal = own('[data-grow="x"]');
      if (horizontal.length)
        gsap.from(horizontal, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.07,
          clearProps: "transform,transformOrigin",
        });
      const vertical = own('[data-grow="y"]');
      if (vertical.length)
        gsap.from(vertical, {
          scaleY: 0,
          transformOrigin: "center bottom",
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.07,
          clearProps: "transform,transformOrigin",
        });
      return () => restore.forEach((undo) => undo());
    });
    return () => media.revert();
  }, []);

  return (
    <div
      ref={scope}
      data-motion
      className={className}
      style={{ display: "contents" }}
    >
      {children}
    </div>
  );
}
