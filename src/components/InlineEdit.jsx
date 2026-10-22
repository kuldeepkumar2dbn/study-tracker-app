import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export default function InlineEdit({
  value,
  onSave,
  type = 'text',
  min = 1,
  max = 200,
  step = 1,
  suffix = '',
  placeholder = 'Click to edit...',
  className = '',
  inputClassName = '',
  showPencil = true,
  allowEmpty = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleStartEditing = (e) => {
    e.stopPropagation();
    setTempValue(value);
    setIsEditing(true);
  };

  const handleCancel = (e) => {
    if (e) e.stopPropagation();
    setTempValue(value);
    setIsEditing(false);
  };

  const handleSave = (e) => {
    if (e) e.stopPropagation();
    
    if (type === 'number') {
      const num = Number(tempValue);
      if (isNaN(num)) {
        handleCancel();
        return;
      }
      const clamped = Math.max(min, Math.min(max, num));
      onSave(clamped);
      setIsEditing(false);
      return;
    }

    const trimmed = String(tempValue).trim();
    if (!trimmed && !allowEmpty) {
      handleCancel();
      return;
    }

    if (trimmed !== String(value).trim()) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel(e);
    }
  };

  if (isEditing) {
    return (
      <span 
        onClick={(e) => e.stopPropagation()} 
        className="inline-flex items-center gap-1.5 align-middle"
      >
        <input
          ref={inputRef}
          type={type}
          min={type === 'number' ? min : undefined}
          max={type === 'number' ? max : undefined}
          step={type === 'number' ? step : undefined}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`px-2 py-0.5 rounded-lg bg-theme-surface border border-theme-accent text-theme-text font-medium text-xs focus:outline-none ring-2 ring-theme-accent/20 transition-all ${
            type === 'number' ? 'w-20 font-mono-numbers' : 'min-w-[140px]'
          } ${inputClassName}`}
        />
        <button
          type="button"
          onClick={handleSave}
          title="Save (Enter)"
          className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          title="Cancel (Esc)"
          className="p-1 rounded-md bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text border border-theme-border transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={handleStartEditing}
      title="Click to rename"
      className={`group/inline inline-flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-theme-surface/70 transition-colors ${className}`}
    >
      <span className="truncate">
        {value}
        {suffix && <span className="ml-1 opacity-80">{suffix}</span>}
      </span>
      {showPencil && (
        <Pencil className="w-3 h-3 text-theme-muted group-hover/inline:text-theme-accent opacity-0 group-hover/inline:opacity-100 transition-all shrink-0" />
      )}
    </span>
  );
}
