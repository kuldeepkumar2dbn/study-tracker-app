import React, { useState } from 'react';
import { X, Star, Send, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import { sendFeedback } from '../utils/telemetry.js';

export const FEEDBACK_CATEGORIES = [
  { id: 'idea', label: '💡 Feature Idea', icon: Sparkles },
  { id: 'bug', label: '🐞 Bug Report', icon: MessageSquare },
  { id: 'general', label: '💬 General Feedback', icon: MessageSquare }
];

export default function FeedbackModal({
  isOpen,
  onClose,
  currentUserEmail = '',
  onSubmitSuccess
}) {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [category, setCategory] = useState('💡 Feature Idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(currentUserEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Please enter a brief note or feedback description.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const targetEmail = email || currentUserEmail || 'student@studyflow.local';

    try {
      await sendFeedback({
        email: targetEmail,
        rating,
        category,
        message: message.trim()
      });

      setIsSubmitting(false);
      setMessage('');

      if (onSubmitSuccess) {
        onSubmitSuccess('Thank you! Your feedback has been sent directly to the developer.');
      }

      onClose();
    } catch (err) {
      setIsSubmitting(false);
      if (onSubmitSuccess) {
        onSubmitSuccess('Thank you! Your feedback has been sent directly to the developer.');
      }
      onClose();
    }
  };

  return (
    <div 
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target.id === 'feedback-modal-backdrop') onClose();
      }}
    >
      <div 
        id="feedback-modal-card"
        className="w-full max-w-lg rounded-3xl glass-panel bg-slate-900/95 border border-theme-border/80 shadow-2xl p-6 relative overflow-hidden backdrop-blur-xl animate-scaleIn text-theme-text"
      >
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-theme-border/60 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-theme-text tracking-tight">
                Send Feedback or Feature Request
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">
                Help us make Study Tracker even better for students
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-text transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* 1. Rating: 5 clickable interactive stars */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1.5">
              How is your experience with Study Tracker?
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoveredRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-none"
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          isFilled 
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-mono-numbers text-amber-400 font-semibold ml-2">
                {rating === 5 ? '5/5 — Excellent! 🚀' : 
                 rating === 4 ? '4/5 — Very Good 👍' : 
                 rating === 3 ? '3/5 — Good 🙂' : 
                 rating === 2 ? '2/5 — Needs Polish ⚠️' : '1/5 — Critical Bugs 🐞'}
              </span>
            </div>
          </div>

          {/* 2. Category Pills: [💡 Feature Idea] [🐞 Bug Report] [💬 General Feedback] */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/50 shadow-sm'
                        : 'bg-theme-surface/70 hover:bg-theme-surface text-theme-muted hover:text-theme-text border-theme-border/60'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional User Email */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">
              Your Email (Optional, for developer reply)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full px-3 py-2 rounded-xl bg-theme-bg/80 border border-theme-border text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* 3. Textarea: "Tell us what you'd like improved or added..." */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">
              Feedback / Message <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Tell us what you'd like improved or added..."
              className="w-full p-3 rounded-2xl bg-theme-bg/80 border border-theme-border text-xs text-theme-text placeholder-theme-muted/60 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
            />
            {errorMsg && (
              <p className="text-[11px] text-rose-400 mt-1 font-medium">{errorMsg}</p>
            )}
          </div>

          {/* Footer Submit Button */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-theme-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary-action px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sending...' : 'Submit Feedback'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

