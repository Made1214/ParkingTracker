"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import styles from "./auth-orbit.module.css";

/** Amigos e iconos que giran juntos; el radio va en unidades de 500. */
const riders = [
  {
    src: "/illustrations/friend-curls.webp",
    angle: -62,
    radius: 212,
    size: 92,
  },
  {
    src: "/illustrations/friend-glasses.webp",
    angle: 10,
    radius: 212,
    size: 92,
  },
  { src: "/illustrations/friend-wave.webp", angle: 82, radius: 212, size: 100 },
  {
    src: "/illustrations/friend-ponytail.webp",
    angle: 154,
    radius: 212,
    size: 92,
  },
  { src: "/illustrations/friend-cap.webp", angle: -134, radius: 212, size: 92 },
  { src: "/illustrations/icon-cheers.webp", angle: 118, radius: 146, size: 62 },
  { src: "/illustrations/icon-camera.webp", angle: -26, radius: 150, size: 54 },
];

/** Destellos de cuatro puntas y partículas, en unidades de 500. */
const sparkles = [
  { x: 322, y: 120, r: 10, tone: "jade" },
  { x: 404, y: 196, r: 6, tone: "lavender" },
  { x: 92, y: 168, r: 7, tone: "lavender" },
  { x: 420, y: 352, r: 9, tone: "jade" },
  { x: 128, y: 384, r: 8, tone: "jade" },
  { x: 300, y: 446, r: 6, tone: "lavender" },
  { x: 186, y: 64, r: 5, tone: "jade" },
  { x: 474, y: 268, r: 5, tone: "lavender" },
] as const;
const dots = [
  { x: 170, y: 340, r: 2.5, tone: "jade" },
  { x: 360, y: 310, r: 3, tone: "lavender" },
  { x: 150, y: 160, r: 2.5, tone: "lavender" },
  { x: 372, y: 96, r: 2, tone: "jade" },
  { x: 60, y: 300, r: 2, tone: "lavender" },
  { x: 446, y: 420, r: 2.5, tone: "jade" },
] as const;

const star = (x: number, y: number, r: number) => {
  const k = r * 0.2;
  return `M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`;
};

/**
 * Ilustración del acceso: el grupo y sus planes orbitando alrededor de un
 * punto de encuentro vacío. Decorativa; con "reducir movimiento" queda quieta.
 */
export function AuthOrbit() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const loop = { ease: "none", repeat: -1 } as const;
      // Los anillos giran a ritmos distintos para que la órbita respire.
      for (const ring of element.querySelectorAll<SVGElement>("[data-spin]")) {
        const seconds = Number(ring.dataset.spin);
        gsap.to(ring, {
          rotation: seconds > 0 ? 360 : -360,
          svgOrigin: "250 250",
          duration: Math.abs(seconds),
          ...loop,
        });
      }
      // Amigos e iconos giran juntos; cada uno se contrarrota para seguir derecho.
      gsap.to(element.querySelector("[data-rotor]"), {
        rotation: 360,
        duration: 140,
        ...loop,
      });
      gsap.to(element.querySelectorAll("[data-upright]"), {
        rotation: -360,
        duration: 140,
        ...loop,
      });
      gsap.to(element.querySelectorAll("[data-twinkle]"), {
        scale: 0.45,
        opacity: 0.35,
        transformOrigin: "50% 50%",
        duration: 1.8,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.4, from: "random" },
      });
      gsap.to(element.querySelector("[data-glow]"), {
        opacity: 0.45,
        duration: 2.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      // Al cargar, los amigos llegan a su sitio uno tras otro.
      gsap.from(element.querySelectorAll("[data-pop]"), {
        scale: 0,
        opacity: 0,
        duration: 0.7,
        ease: "back.out(1.6)",
        stagger: 0.09,
        delay: 0.25,
      });
    });
    return () => media.revert();
  }, []);

  return (
    <div ref={root} className={styles.orbit} aria-hidden="true">
      <span className={styles.blob} />
      <div className={styles.veil}>
        <div className={styles.stage}>
          <svg viewBox="0 0 500 500" className={styles.rings} fill="none">
            <defs>
              <linearGradient id="orbit-core" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2fcb9f" />
                <stop offset="0.55" stopColor="#9381ff" />
                <stop offset="1" stopColor="#2fcb9f" />
              </linearGradient>
              <linearGradient id="orbit-trail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#2fcb9f" stopOpacity="0" />
                <stop offset="1" stopColor="#2fcb9f" />
              </linearGradient>
              <filter
                id="orbit-glow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>

            {/* Órbita exterior punteada */}
            <g data-spin="90">
              <circle
                cx="250"
                cy="250"
                r="212"
                stroke="#9381ff"
                strokeWidth="2"
                strokeDasharray="8 10"
                strokeLinecap="round"
                opacity="0.45"
              />
            </g>

            {/* Órbita media con apertura y estelas de viento */}
            <g data-spin="-60">
              <path
                d="M250 70A180 180 0 1 1 80 310"
                stroke="#b8b8ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.45"
              />
              <path
                d="M118 128A180 180 0 0 1 214 73"
                stroke="url(#orbit-trail)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M392 360A180 180 0 0 1 310 420"
                stroke="url(#orbit-trail)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d="M101 141A190 190 0 0 1 140 101"
                stroke="#b8b8ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* Anillo central luminoso: el punto de encuentro */}
            <circle
              data-glow
              cx="250"
              cy="250"
              r="105"
              stroke="url(#orbit-core)"
              strokeWidth="10"
              opacity="0.25"
              filter="url(#orbit-glow)"
            />
            <g data-spin="40">
              <circle
                cx="250"
                cy="250"
                r="105"
                stroke="url(#orbit-core)"
                strokeWidth="2.5"
                opacity="0.85"
              />
              <circle cx="355" cy="250" r="4" fill="#2fcb9f" />
              <circle cx="176" cy="176" r="3" fill="#b8b8ff" />
            </g>
            <g data-spin="-28">
              <circle
                cx="250"
                cy="250"
                r="85"
                stroke="#9381ff"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                opacity="0.45"
              />
            </g>

            {sparkles.map(({ x, y, r, tone }) => (
              <path
                key={`${x}-${y}`}
                d={star(x, y, r)}
                className={styles[tone]}
                data-twinkle
              />
            ))}
            {dots.map(({ x, y, r, tone }) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={r}
                className={styles[tone]}
                data-twinkle
              />
            ))}
          </svg>

          <div className={styles.rotor} data-rotor>
            {riders.map(({ src, angle, radius, size }) => (
              <div
                key={src}
                className={styles.slot}
                style={
                  {
                    "--angle": `${angle}deg`,
                    "--radius": `${(radius / 500) * 100}%`,
                    "--size": `${(size / 500) * 100}%`,
                  } as CSSProperties
                }
              >
                <span className={styles.rider}>
                  <span data-upright>
                    {/* Ilustraciones estáticas del propio proyecto. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" data-pop draggable={false} />
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
