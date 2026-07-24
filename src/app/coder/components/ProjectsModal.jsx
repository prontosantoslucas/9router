"use client";

import PropTypes from "prop-types";

export default function ProjectsModal({ isOpen, onClose, projects, activeProjectId, onSelectProject, onCreateProject }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-elevated overflow-hidden text-text-main">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-alt/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-500 text-[20px]">folder_copy</span>
            <h2 className="font-bold text-base text-text-main">Projetos Coder</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-2 transition-colors">
            ✕
          </button>
        </div>

        {/* Project List */}
        <div className="p-5 max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <div
                key={proj.id}
                onClick={() => {
                  onSelectProject(proj.id);
                  onClose();
                }}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-500 font-semibold"
                    : "bg-surface-2 border-border hover:border-brand-500/50 text-text-main"
                }`}
              >
                <div>
                  <h3 className="font-semibold text-sm text-text-main">{proj.name}</h3>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">{proj.filesCount || 6} arquivos • Editado recentemente</p>
                </div>
                {isActive && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-brand-500/20 text-brand-500 border border-brand-500/30">
                    Ativo
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="px-5 py-4 bg-bg border-t border-border flex items-center justify-between">
          <button
            onClick={() => {
              onCreateProject();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-soft"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Novo Projeto</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-muted text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

ProjectsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  projects: PropTypes.array.isRequired,
  activeProjectId: PropTypes.string.isRequired,
  onSelectProject: PropTypes.func.isRequired,
  onCreateProject: PropTypes.func.isRequired,
};
