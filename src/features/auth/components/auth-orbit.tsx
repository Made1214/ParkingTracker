"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { Camera, CupSoda, Pizza, Wine } from "lucide-react";
import styles from "./auth-orbit.module.css";

type Person = {
  bg: string;
  skin: string;
  hair: string;
  shirt: string;
  style: "afro" | "cap" | "ponytail" | "glasses" | "waves" | "short";
};

const people: (Person & { angle: number })[] = [
  {
    angle: -80,
    style: "afro",
    bg: "#7fe3c0",
    skin: "#8d5a3b",
    hair: "#2a1a1a",
    shirt: "#c9c2f5",
  },
  {
    angle: -16,
    style: "glasses",
    bg: "#cfc8f7",
    skin: "#f3d2b3",
    hair: "#7a4a2a",
    shirt: "#3f9d83",
  },
  {
    angle: 52,
    style: "short",
    bg: "#c9f5e4",
    skin: "#b97a50",
    hair: "#2a1a1a",
    shirt: "#3f9d83",
  },
  {
    angle: 146,
    style: "waves",
    bg: "#7fe3c0",
    skin: "#a86b45",
    hair: "#3a2018",
    shirt: "#9381ff",
  },
  {
    angle: -130,
    style: "cap",
    bg: "#c9f5e4",
    skin: "#f1c9a5",
    hair: "#5b63c9",
    shirt: "#2e2a6b",
  },
];
const ponytail: Person = {
  style: "ponytail",
  bg: "#cfc8f7",
  skin: "#e8b894",
  hair: "#4a2c2a",
  shirt: "#7fe3c0",
};

const sparkles = [
  { x: 39, y: 15, size: 5.5, tone: "jade" },
  { x: 54, y: 19, size: 3, tone: "lavender" },
  { x: 16, y: 31, size: 4, tone: "lavender" },
  { x: 86, y: 30, size: 4, tone: "jade" },
  { x: 81, y: 27, size: 2, tone: "jade" },
  { x: 95, y: 57, size: 4.5, tone: "lavender" },
  { x: 27, y: 80, size: 4, tone: "jade" },
  { x: 88, y: 83, size: 3.5, tone: "lavender" },
  { x: 65, y: 96, size: 6, tone: "jade" },
  { x: 12, y: 88, size: 3, tone: "lavender" },
] as const;

const slot = (angle: number) => ({ "--angle": `${angle}deg` }) as CSSProperties;

/** Rostro plano dentro de un círculo: fondo, hombros, cabeza y peinado. */
function Face({ bg, skin, hair, shirt, style }: Person) {
  return (
    <svg viewBox="0 0 100 100" className={styles.face} aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={bg} />
      {style === "afro" && <circle cx="50" cy="38" r="28" fill={hair} />}
      {style === "waves" && (
        <path
          d="M22 44c0-20 12-30 28-30s28 10 28 30c0 14 4 22-2 30H24c-6-8-2-16-2-30Z"
          fill={hair}
        />
      )}
      {style === "ponytail" && (
        <path d="M66 30c14 2 18 16 12 30-2-10-6-16-14-18Z" fill={hair} />
      )}
      <path d="M14 100c2-20 16-28 36-28s34 8 36 28Z" fill={shirt} />
      <rect x="43" y="58" width="14" height="18" rx="6" fill={skin} />
      <ellipse cx="50" cy="46" rx="17" ry="19" fill={skin} />
      {style === "afro" && (
        <path
          d="M32 42c0-12 8-18 18-18s18 6 18 18c-6-8-12-10-18-10s-12 2-18 10Z"
          fill={hair}
        />
      )}
      {style === "cap" && (
        <>
          <path d="M32 40c0-13 8-20 18-20s18 7 18 20Z" fill={hair} />
          <path d="M30 40h44c3 0 5 2 5 4H30Z" fill={hair} />
        </>
      )}
      {style === "ponytail" && (
        <path
          d="M32 46c-2-16 6-24 18-24s20 8 18 22c-6-10-14-14-24-12-6 2-10 6-12 14Z"
          fill={hair}
        />
      )}
      {style === "glasses" && (
        <>
          <path
            d="M32 42c-2-14 6-20 18-20s20 6 18 20c-4-8-10-11-18-11s-14 3-18 11Z"
            fill={hair}
          />
          <g fill="none" stroke="#2a1a1a" strokeWidth="1.8">
            <circle cx="43" cy="47" r="5.5" />
            <circle cx="57" cy="47" r="5.5" />
            <path d="M48.5 47h3" />
          </g>
        </>
      )}
      {style === "waves" && (
        <path
          d="M32 44c0-13 8-19 18-19s18 6 18 19c-5-7-11-9-18-9s-13 2-18 9Z"
          fill={hair}
        />
      )}
      {style === "short" && (
        <path
          d="M32 44c-3-15 6-22 18-22s21 7 18 22c-3-8-9-12-18-12s-15 4-18 12Z"
          fill={hair}
        />
      )}
      <circle cx="43" cy="47" r="1.8" fill="#2a1a1a" />
      <circle cx="57" cy="47" r="1.8" fill="#2a1a1a" />
      <path
        d="M44 54q6 5 12 0"
        fill="none"
        stroke="#2a1a1a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Ilustración del acceso: el grupo y sus planes orbitando alrededor de un
 * punto de encuentro. Decorativa; con "reducir movimiento" queda quieta.
 */
export function AuthOrbit() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // Cada anillo gira a su ritmo; lo que lleva encima gira al revés
      // para que caras e iconos sigan derechos.
      for (const ring of element.querySelectorAll<HTMLElement>("[data-spin]")) {
        const duration = Number(ring.dataset.spin);
        const turn = { duration: Math.abs(duration), ease: "none", repeat: -1 };
        gsap.to(ring, { rotation: duration > 0 ? 360 : -360, ...turn });
        const upright = ring.querySelectorAll("[data-upright]");
        if (upright.length)
          gsap.to(upright, { rotation: duration > 0 ? -360 : 360, ...turn });
      }
      gsap.to(element.querySelectorAll("[data-twinkle]"), {
        scale: 0.55,
        opacity: 0.45,
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.35, from: "random" },
      });
    });
    return () => media.revert();
  }, []);

  return (
    <div ref={root} className={styles.orbit} aria-hidden="true">
      <span className={styles.blob} />
      <div className={styles.veil}>
        <div className={styles.stage}>
          {sparkles.map((sparkle) => (
            <span
              key={`${sparkle.x}-${sparkle.y}`}
              className={styles.sparkle}
              data-tone={sparkle.tone}
              style={{
                left: `${sparkle.x}%`,
                top: `${sparkle.y}%`,
                width: `${sparkle.size}%`,
              }}
            >
              <svg viewBox="0 0 20 20" data-twinkle>
                <path d="M10 0Q11.4 8.6 20 10Q11.4 11.4 10 20Q8.6 11.4 0 10Q8.6 8.6 10 0Z" />
              </svg>
            </span>
          ))}

          <div className={`${styles.ring} ${styles.far}`} data-spin="150">
            <div className={styles.slot} style={slot(-47)}>
              <span className={styles.icon}>
                <span data-upright>
                  <CupSoda />
                </span>
              </span>
            </div>
            <div className={styles.slot} style={slot(82)}>
              <span className={styles.icon}>
                <span data-upright>
                  <Camera />
                </span>
              </span>
            </div>
          </div>

          <div className={`${styles.ring} ${styles.outer}`} data-spin="110">
            <svg viewBox="0 0 200 200" className={styles.track}>
              <circle cx="100" cy="100" r="99" className={styles.dashed} />
              <path d="M162 22A99 99 0 0 1 190 60" className={styles.streak} />
              <path d="M38 178A99 99 0 0 1 12 144" className={styles.streak} />
              <path
                d="M176 164A99 99 0 0 1 150 186"
                className={styles.streakSoft}
              />
            </svg>
            {people.map(({ angle, ...person }) => (
              <div
                key={person.style}
                className={styles.slot}
                style={slot(angle)}
              >
                <span className={styles.avatar}>
                  <span data-upright>
                    <Face {...person} />
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className={`${styles.ring} ${styles.middle}`} data-spin="-80">
            <svg viewBox="0 0 200 200" className={styles.track}>
              <circle cx="100" cy="100" r="99" className={styles.dashed} />
              <path d="M120 3A99 99 0 0 1 172 32" className={styles.streak} />
            </svg>
            <div className={styles.slot} style={slot(-150)}>
              <span className={styles.avatar}>
                <span data-upright>
                  <Face {...ponytail} />
                </span>
              </span>
            </div>
            <div className={styles.slot} style={slot(-108)}>
              <span className={styles.icon}>
                <span data-upright>
                  <Pizza />
                </span>
              </span>
            </div>
            <div className={styles.slot} style={slot(18)}>
              <span className={styles.icon}>
                <span data-upright>
                  <Camera />
                </span>
              </span>
            </div>
            <div className={styles.slot} style={slot(108)}>
              <span className={styles.icon}>
                <span data-upright>
                  <Wine />
                </span>
              </span>
            </div>
          </div>

          <div className={`${styles.ring} ${styles.core}`} data-spin="36">
            <svg viewBox="0 0 200 200" className={styles.track}>
              <circle cx="100" cy="100" r="97" className={styles.solid} />
              <circle cx="100" cy="100" r="80" className={styles.solidThin} />
              <circle cx="172" cy="64" r="4" className={styles.dot} />
              <circle cx="30" cy="140" r="4" className={styles.dot} />
              <circle cx="128" cy="175" r="3.5" className={styles.dotSoft} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
