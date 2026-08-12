"use client";

import { useEffect, useRef, useState } from "react";

// Envolvente que anima o filho quando entra na viewport.
// Uso:
//   <Reveal>...</Reveal>                    // fade + slide up (default)
//   <Reveal variant="scale" delay={120}>...</Reveal>
//   <Reveal variant="left" delay={200}>...</Reveal>
//
// Também dispara ao carregar a página se já estiver visível (hero elements).

const VARIANTS = {
  up:    { hidden: "opacity-0 translate-y-6",          shown: "opacity-100 translate-y-0" },
  down:  { hidden: "opacity-0 -translate-y-6",         shown: "opacity-100 translate-y-0" },
  left:  { hidden: "opacity-0 translate-x-6",          shown: "opacity-100 translate-x-0" },
  right: { hidden: "opacity-0 -translate-x-6",         shown: "opacity-100 translate-x-0" },
  scale: { hidden: "opacity-0 scale-95",               shown: "opacity-100 scale-100" },
  bounce:{ hidden: "opacity-0 translate-y-10 scale-95", shown: "opacity-100 translate-y-0 scale-100" },
};

export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  duration = 700,
  once = true,
  as: Tag = "div",
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  // Inicializa já considerando prefers-reduced-motion — sem setState em effect
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    // Se já entrou na viewport (hero above-fold), animar já ao carregar
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      const t = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(t);
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setVisible(true), delay);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, once, visible]);

  const v = VARIANTS[variant] || VARIANTS.up;
  const bounceEase = variant === "bounce"
    ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
    : "cubic-bezier(0.22, 1, 0.36, 1)";
  const style = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: bounceEase,
    willChange: visible ? "auto" : "opacity, transform",
  };

  return (
    <Tag
      ref={ref}
      style={style}
      className={`${visible ? v.shown : v.hidden} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
