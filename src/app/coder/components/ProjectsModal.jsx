"use client";

import PropTypes from "prop-types";

export default function ProjectsModal({ isOpen, onClose, projects, activeProjectId, onSelectProject, onCreateProject }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#141417] border border-[#26262B] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26262B]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-[20px]">folder_copy</span>
            <h2 className="font-semibold text-base text-white">Meus Projetos Coder</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#26262B] transition-colors">
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
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
                    : "bg-[#1B1B1F] border-[#2B2B32] hover:border-slate-600 text-slate-300"
                }`}
              >
                <div>
                  <h3 className="font-medium text-sm text-white">{proj.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{proj.filesCount || 6} arquivos • Editado recentemente</p>
                </div>
                {isActive && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Ativo
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="px-5 py-4 bg-[#101013] border-t border-[#26262B] flex items-center justify-between">
          <button
            onClick={() => {
              onCreateProject();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Novo Projeto</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#222227] hover:bg-[#2C2C33] text-slate-300 text-xs font-medium transition-colors"
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
