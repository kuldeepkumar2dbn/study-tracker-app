import React from 'react';
import { Award, Play, ExternalLink } from 'lucide-react';
import { formatSkillChipLabel } from '../utils/routineSkillSync';

export default function SkillRoutineChip({ skillLink }) {
  if (!skillLink || !skillLink.skillTitle) return null;

  const label = formatSkillChipLabel(skillLink);
  const videoUrl = skillLink.videoUrl || (skillLink.videoId ? `https://www.youtube.com/watch?v=${skillLink.videoId}` : null);

  return (
    <div
      onClick={(e) => {
        // Prevent toggling parent routine block
        e.stopPropagation();
      }}
      className="skill-routine-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors w-fit select-none"
      title={`Skill Course: ${skillLink.skillTitle}`}
      data-testid="skill-routine-chip"
    >
      <span className="truncate max-w-[220px] sm:max-w-md font-medium">
        {label}
      </span>

      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/35 text-[10px] font-semibold text-purple-300 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
          title="Watch this lecture on YouTube"
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>▶ Watch</span>
        </a>
      )}
    </div>
  );
}
