"use client";

import { track } from "./track";

// Âncora de CTA com evento de conversão. Existe porque page.js é server
// component (não pode ter onClick) — e sem evento por CTA não há como
// distinguir "100 visitas, 0 cliques" de "3 visitas, 3 cliques", que pedem
// correções opostas na página.
//
// `external` = abre em nova aba (WhatsApp). Âncora interna (#demo) precisa
// navegar na mesma aba, senão abre uma cópia da página numa aba nova.
export default function CtaLink({
  href,
  location,
  external = true,
  className,
  children,
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => track("cta_click", { cta_location: location })}
      className={className}
    >
      {children}
    </a>
  );
}
