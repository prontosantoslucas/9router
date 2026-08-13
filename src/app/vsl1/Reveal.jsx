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
  // SEMPRE inicia oculto — tem que bater com o que o servidor renderiza.
  // Ler prefers-reduced-motion aqui no initializer causava mismatch de
  // hidratação (servidor: opacity-0, cliente com reduced-motion: opacity-100);
  // o React abortava a hidratação e a página INTEIRA ficava invisível, já que
  // todas as seções da VSL são embrulhadas em <Reveal>. A preferência de
  // motion é aplicada no effect abaixo, onde só o cliente roda.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    // Sistema pede menos animação: revela sem esperar viewport nem delay.
    // Vai via setTimeout(0) — e não setState direto — pelo mesmo motivo do
    // resto do arquivo: setState síncrono no corpo do effect encadeia render.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
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
