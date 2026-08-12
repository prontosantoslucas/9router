// Ícones SVG inline (stroke-based, estilo Lucide/Feather). Não depende de
// Material Symbols font — que estava sendo cacheada pelo Service Worker e
// deixava alguns visitantes com ícones invisíveis se acessaram a página
// antes do deploy correto.
//
// Uso: <Icon name="chat" className="w-5 h-5" />

const PATHS = {
  smart_toy: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1" />
      <circle cx="15" cy="13" r="1" />
      <path d="M9 17h6" />
    </>
  ),
  chat: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  play_arrow: <polygon points="6 3 20 12 6 21 6 3" />,
  hearing: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 3-2 4-3 6-1 2-1 4-3 4" />
      <path d="M9 20c-3 0-4-2-4-4" />
      <circle cx="12" cy="8" r="1" />
    </>
  ),
  psychology: (
    <>
      <path d="M13 21a8 8 0 0 0 8-8V7a4 4 0 0 0-8 0" />
      <path d="M9 3a4 4 0 0 0-4 4v6a8 8 0 0 0 4 7" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="14" cy="10" r="1.5" />
    </>
  ),
  event_available: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </>
  ),
  check_circle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  add: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  arrow_forward: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  videocam: (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>
  ),
  call: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
};

export default function Icon({ name, className = "w-5 h-5", strokeWidth = 2, ...rest }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths}
    </svg>
  );
}
