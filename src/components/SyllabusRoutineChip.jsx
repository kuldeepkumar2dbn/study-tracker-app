import React from 'react';
import { ExternalLink } from 'lucide-react';
import { formatSyllabusChipLabel } from '../utils/routineSyllabusSync';

export default function SyllabusRoutineChip({ syllabusLink, subjects = [] }) {
  if (!syllabusLink || !syllabusLink.subjectId) return null;

  const label = formatSyllabusChipLabel(syllabusLink, subjects);
  const targetUrl = `/syllabus.html#${encodeURIComponent(syllabusLink.subjectId)}`;

  return (
    <a
      href={targetUrl}
      onClick={(e) => {
        // Prevent toggling the routine block
        e.stopPropagation();
      }}
      className="syllabus-topic-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-colors w-fit cursor-pointer group"
      title={`Open syllabus for ${syllabusLink.subjectName || 'Subject'}`}
      data-testid="syllabus-chip"
    >
      <span className="truncate max-w-[260px] sm:max-w-md">{label}</span>
      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}
