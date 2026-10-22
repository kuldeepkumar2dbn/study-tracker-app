import React, { useState } from 'react';
import { 
  Award, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Sliders, 
  Sparkles, 
  FolderGit2, 
  Flame,
  X,
  Check,
  CheckSquare,
  Tag
} from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function SkillsTab() {
  const { 
    skills, 
    addSkill, 
    updateSkillLevel, 
    addSkillMilestone, 
    toggleSkillMilestone, 
    logSkillHours 
  } = useData();

  const [filterCategory, setFilterCategory] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New skill form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Engineering');
  const [levelNum, setLevelNum] = useState(3);
  const [masteryPct, setMasteryPct] = useState(60);
  const [tagsInput, setTagsInput] = useState('');

  // Inline milestone input per skill
  const [newMilestoneTitles, setNewMilestoneTitles] = useState({});
  const [newMilestoneTypes, setNewMilestoneTypes] = useState({});

  const categories = ['All', ...new Set(skills.map(s => s.category || 'General'))];

  const filteredSkills = skills.filter(sk => {
    return filterCategory === 'All' || sk.category === filterCategory;
  });

  const getTierDetails = (level) => {
    switch (Number(level)) {
      case 1: return { label: 'Level 1: Novice', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' };
      case 2: return { label: 'Level 2: Apprentice', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 3: return { label: 'Level 3: Intermediate', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 4: return { label: 'Level 4: Advanced', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 5: return { label: 'Level 5: Expert', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      default: return { label: 'Level 3: Intermediate', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    }
  };

  const handleCreateSkill = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tagsArr = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    addSkill({
      name: name.trim(),
      category,
      levelNum: Number(levelNum),
      masteryPct: Number(masteryPct),
      tags: tagsArr.length ? tagsArr : ['Skill']
    });

    setName('');
    setTagsInput('');
    setIsAddModalOpen(false);
  };

  const handleAddMilestone = (skillId) => {
    const title = newMilestoneTitles[skillId];
    if (!title || !title.trim()) return;
    const type = newMilestoneTypes[skillId] || 'project';

    addSkillMilestone(skillId, title.trim(), type);
    setNewMilestoneTitles(prev => ({ ...prev, [skillId]: '' }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <Award className="w-6 h-6 text-theme-accent" />
            Skill Progression & Milestones
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Track competency mastery using 1-5 level sliders, progress bars, and portfolio project logs.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Skill</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === cat
                ? 'bg-theme-accent text-white shadow-sm'
                : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSkills.map((skill) => {
          const tier = getTierDetails(skill.levelNum);
          const completedMilestonesCount = (skill.milestones || []).filter(m => m.done).length;
          const totalMilestonesCount = (skill.milestones || []).length;

          return (
            <div 
              key={skill.id}
              className="rounded-2xl glass-panel p-6 border border-theme-border hover:border-theme-accent/40 transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tier.color}`}>
                    {tier.label}
                  </span>
                  <span className="text-xs text-theme-muted">{skill.category}</span>
                </div>

                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-display font-bold text-lg text-theme-text">
                    {skill.name}
                  </h3>
                  <span className="font-mono-numbers font-bold text-theme-accent text-sm">
                    {skill.masteryPct}% Mastery
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(skill.tags || []).map((tg, i) => (
                    <span 
                      key={i} 
                      className="text-[10px] px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted"
                    >
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* 1-5 Level Slider & Progress Bar */}
                <div className="p-4 rounded-xl bg-theme-bg/60 border border-theme-border/60 mb-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-theme-muted font-medium flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-theme-accent" />
                      Proficiency Level Slider (1 - 5)
                    </span>
                    <span className="font-mono-numbers font-bold text-theme-text">
                      Tier {skill.levelNum} / 5
                    </span>
                  </div>

                  {/* Level Slider Input */}
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={skill.levelNum}
                    onChange={(e) => {
                      const lvl = Number(e.target.value);
                      updateSkillLevel(skill.id, lvl, Math.min(100, lvl * 20));
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-2 bg-theme-surface rounded-lg appearance-none"
                  />

                  {/* Visual Gradient Progress Bar */}
                  <div>
                    <div className="w-full h-2.5 rounded-full bg-theme-surface overflow-hidden border border-theme-border/40">
                      <div 
                        className="h-full bg-gradient-to-r from-theme-accent via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, skill.masteryPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Milestones & Completed Projects Log */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                      Key Milestones & Projects ({completedMilestonesCount}/{totalMilestonesCount})
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(skill.milestones || []).map((m) => (
                      <div
                        key={m.id}
                        onClick={() => toggleSkillMilestone(skill.id, m.id)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                          m.done 
                            ? 'bg-theme-bg/40 text-theme-muted border-theme-border/40 line-through' 
                            : 'bg-theme-surface text-theme-text border-theme-border hover:border-theme-accent/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {m.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-theme-muted shrink-0" />
                          )}
                          <span className="truncate">{m.title}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                          m.type === 'project' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {m.type === 'project' ? 'Project' : 'Milestone'}
                        </span>
                      </div>
                    ))}

                    {(!skill.milestones || skill.milestones.length === 0) && (
                      <p className="text-xs text-theme-muted italic py-1">
                        No projects or milestones logged yet.
                      </p>
                    )}
                  </div>

                  {/* Add Milestone Inline Field */}
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Log key milestone or completed project..."
                      value={newMilestoneTitles[skill.id] || ''}
                      onChange={(e) => setNewMilestoneTitles(prev => ({ ...prev, [skill.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddMilestone(skill.id);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
                    />

                    <select
                      value={newMilestoneTypes[skill.id] || 'project'}
                      onChange={(e) => setNewMilestoneTypes(prev => ({ ...prev, [skill.id]: e.target.value }))}
                      className="px-2 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none"
                    >
                      <option value="project">Project</option>
                      <option value="milestone">Milestone</option>
                    </select>

                    <button
                      onClick={() => handleAddMilestone(skill.id)}
                      className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-theme-accent" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Hours Log Footer */}
              <div className="pt-3 border-t border-theme-border/60 flex items-center justify-between text-xs">
                <span className="text-theme-muted">
                  Logged: <strong className="text-theme-text font-mono-numbers">{skill.hoursLogged} hrs</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => logSkillHours(skill.id, 1)}
                    className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-accent transition-colors"
                  >
                    +1h Practice
                  </button>
                  <button
                    onClick={() => logSkillHours(skill.id, 2)}
                    className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-accent transition-colors"
                  >
                    +2h Deep Work
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Skill Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">Track New Skill Competency</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSkill} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Skill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python, Circuit Analysis, System Design"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Core, Backend, Math"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              {/* Level & Mastery % */}
              <div className="space-y-3 p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-theme-text">Initial Level Slider (1 - 5):</label>
                  <span className="font-bold text-theme-accent font-mono-numbers">Level {levelNum}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={levelNum}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLevelNum(val);
                    setMasteryPct(val * 20);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-theme-bg rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] text-theme-muted font-mono-numbers">
                  <span>1: Novice</span>
                  <span>2: Apprentice</span>
                  <span>3: Intermediate</span>
                  <span>4: Advanced</span>
                  <span>5: Expert</span>
                </div>
              </div>

              <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold hover:bg-theme-accentHover shadow-sm"
                >
                  Track Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
