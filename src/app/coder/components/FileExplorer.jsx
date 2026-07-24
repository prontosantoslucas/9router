"use client";

import { useState } from "react";
import PropTypes from "prop-types";

export default function FileExplorer({ files, selectedFile, onSelectFile }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({ src: true, ".bolt": true });

  const toggleFolder = (folderName) => {
    setExpandedFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group files into folder tree
  const tree = buildTree(filteredFiles);

  return (
    <aside className="w-64 border-r border-[#1E1E22] bg-[#0E0E10] text-[#9EA1B0] flex flex-col h-full text-xs font-mono select-none">
      {/* Top File Explorer bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E1E22]">
        <div className="flex items-center gap-3 font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          <span className="text-white border-b-2 border-blue-500 pb-0.5">Files</span>
          <span className="text-slate-500 hover:text-slate-400 cursor-pointer">Search</span>
        </div>
      </div>

      {/* Search Input */}
      {searchQuery !== "" && (
        <div className="p-2 border-b border-[#1E1E22]">
          <input
            type="text"
            placeholder="Filtrar arquivos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161619] border border-[#2B2B32] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 text-[11px]"
          />
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1 px-1 custom-scrollbar">
        {renderTree(tree, selectedFile, onSelectFile, expandedFolders, toggleFolder)}
      </div>
    </aside>
  );
}

FileExplorer.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      content: PropTypes.string,
    })
  ).isRequired,
  selectedFile: PropTypes.string,
  onSelectFile: PropTypes.func.isRequired,
};

function buildTree(files) {
  const root = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;
    parts.forEach((part, idx) => {
      if (idx === parts.length - 1) {
        current[part] = { _file: file };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  return root;
}

function renderTree(node, selectedFile, onSelectFile, expandedFolders, toggleFolder, parentPath = "") {
  return Object.entries(node).map(([key, val]) => {
    const currentPath = parentPath ? `${parentPath}/${key}` : key;
    const isFile = !!val._file;

    if (isFile) {
      const isSelected = selectedFile === val._file.path;
      return (
        <button
          key={currentPath}
          onClick={() => onSelectFile(val._file.path)}
          className={`w-full flex items-center gap-2 px-3 py-1 rounded text-left transition-colors font-mono text-[11px] ${
            isSelected
              ? "bg-[#1E2638] text-blue-400 font-medium border-l-2 border-blue-500"
              : "hover:bg-[#161619] text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[14px] text-slate-500">
            {getFileIcon(key)}
          </span>
          <span className="truncate">{key}</span>
        </button>
      );
    }

    const isExpanded = expandedFolders[key] !== false;
    return (
      <div key={currentPath} className="mb-0.5">
        <button
          onClick={() => toggleFolder(key)}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#161619] text-slate-400 hover:text-slate-200 text-[11px] font-semibold text-left"
        >
          <span className="material-symbols-outlined text-[14px] text-slate-500 transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}>
            chevron_right
          </span>
          <span className="material-symbols-outlined text-[14px] text-amber-500/80">folder</span>
          <span className="truncate">{key}</span>
        </button>
        {isExpanded && (
          <div className="pl-3 border-l border-[#1E1E22]/60 ml-2 mt-0.5 space-y-0.5">
            {renderTree(val, selectedFile, onSelectFile, expandedFolders, toggleFolder, currentPath)}
          </div>
        )}
      </div>
    );
  });
}

function getFileIcon(filename) {
  if (filename.endsWith(".tsx") || filename.endsWith(".jsx") || filename.endsWith(".js") || filename.endsWith(".ts")) return "code";
  if (filename.endsWith(".css") || filename.endsWith(".scss")) return "css";
  if (filename.endsWith(".json")) return "data_object";
  if (filename.endsWith(".html")) return "html";
  return "description";
}
