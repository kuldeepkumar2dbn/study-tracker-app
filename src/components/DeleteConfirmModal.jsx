import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * Safe Deletion Confirmation Modal
 * StudyFlow Skill Tracker
 *
 * Prompts user before removing items with clear explanation of the 6-second undo window.
 */
export default function DeleteConfirmModal({
  isOpen,
  itemType = 'item', // 'subtopic' | 'lecture' | 'level' | 'course' | 'milestone'
  itemName = '',
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
    >
      <div 
        className="w-full max-w-sm rounded-2xl glass-dropdown p-6 shadow-2xl border border-rose-500/30 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-theme-text">
                Confirm Deletion
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                {itemType}
              </span>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="text-theme-muted hover:text-theme-text p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt Body */}
        <div className="mb-6 space-y-2">
          <p className="text-xs text-theme-text font-medium leading-relaxed">
            Delete <strong className="text-white font-semibold break-all">"{itemName || 'this item'}"</strong>? You can undo this action.
          </p>
          <p className="text-[11px] text-theme-muted leading-normal">
            A temporary snapshot will be held in memory for 6 seconds so you can instantly restore it with its checkmarks intact.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-theme-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
