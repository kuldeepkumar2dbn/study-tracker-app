/**
 * Consistency Radar & Study Activity Utilities (src/utils/consistencyRadar.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. 30-Day Vertical Bar Graph calculation:
 *    - 30 consecutive calendar days ending on today's current date
 *    - Daily study hours (hours = minutes / 60)
 *    - Dynamically scaled to user's highest study volume (minimum scale ceiling of 4h)
 *    - 0 mins: low muted baseline pill (height: 3px, bg-slate-800/30)
 *    - >0 mins: emerald gradient bar (bg-gradient-to-t from-emerald-600 to-emerald-400)
 *    - Elevated Tooltips: "[X.X] Hours ([Y] mins) studied on [Day, Month Date]"
 * 2. Top Metrics Strip:
 *    - Active Days: Total count of days in the last 30 days where study minutes > 0 (e.g., "Active Days: 14 / 30")
 *    - Current Streak: Pulled from userData.streak || 0
 *    - 30-Day Total: Sum of hours logged over the last 30 days (e.g., "Total: 42.5h")
 * 3. Backward-compatible helpers for legacy heatmap matrix and tooltip formatting
 */

/**
 * Format tooltip for 30-Day Bar Graph:
 * "[X.X] Hours ([Y] mins) studied on [Day, Month Date]"
 */
export function formatBarTooltip(dateStr, minutes = 0) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dateObj);
  const dateNum = dateObj.getDate();
  const dateLabel = `${dayName}, ${monthName} ${dateNum}`;

  const safeMins = Math.max(0, Number(minutes) || 0);
  const hours = (safeMins / 60).toFixed(1);

  return `${hours} Hours (${safeMins} mins) studied on ${dateLabel}`;
}

/**
 * Calculates 30 consecutive calendar days ending on today (reference date).
 * Reads strictly from userData.dailyActivity[YYYY-MM-DD].
 */
export function calculate30DayBarGraph(dailyActivity = {}, referenceDate = new Date()) {
  const safeActivity = (dailyActivity && typeof dailyActivity === 'object') ? dailyActivity : {};
  const today = new Date(referenceDate);
  const refYear = today.getFullYear();
  const refMonth = today.getMonth();
  const refDate = today.getDate();

  const days = [];
  let activeDaysCount = 0;
  let totalMinutes = 0;

  // 30 consecutive calendar days ending on today (i = 29 down to 0)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(refYear, refMonth, refDate - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const minutes = Math.max(0, Number(safeActivity[dateStr]) || 0);
    const hours = minutes / 60;
    const hoursFormatted = (hours).toFixed(1);

    if (minutes > 0) {
      activeDaysCount++;
      totalMinutes += minutes;
    }

    const isToday = (i === 0);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
    const dateNum = d.getDate();
    const dateLabel = `${dayName}, ${monthName} ${dateNum}`;
    const tooltipText = formatBarTooltip(dateStr, minutes);

    days.push({
      dateStr,
      dateObj: d,
      dayNum: dateNum,
      dayName,
      monthName,
      dateLabel,
      minutes,
      hours,
      hoursFormatted,
      isToday,
      tooltipText
    });
  }

  // Y-Axis dynamic scale: dynamically scaled to user's highest study volume, minimum ceiling of 4h
  const maxHours = Math.max(0, ...days.map(d => d.hours));
  const scaleCeiling = Math.max(4, maxHours > 4 ? Math.ceil(maxHours) : 4);

  // Compute height percentage for each day
  days.forEach(day => {
    if (day.minutes === 0) {
      day.heightPercent = 0; // low muted baseline pill
    } else {
      const pct = (day.hours / scaleCeiling) * 100;
      day.heightPercent = Math.min(100, Math.max(4, Math.round(pct * 10) / 10));
    }
  });

  const totalHours = totalMinutes / 60;
  const totalHoursFormatted = totalHours.toFixed(1);

  return {
    days,
    activeDaysCount,
    totalMinutes,
    totalHours,
    totalHoursFormatted,
    scaleCeiling,
    maxHours
  };
}

/**
 * Backward compatibility: Legacy tooltip formatter
 */
export function formatHeatmapTooltip(dateStr, minutes = 0) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dateObj);
  const dateNum = dateObj.getDate();
  const dateLabel = `${dayName}, ${monthName} ${dateNum}`;

  if (!minutes || minutes <= 0) {
    return `${dateLabel}: No study activity logged`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  let durationText = '';
  if (hours > 0 && remainingMins > 0) {
    durationText = `${hours} hours ${remainingMins} mins`;
  } else if (hours > 0) {
    durationText = `${hours} hours`;
  } else {
    durationText = `${remainingMins} mins`;
  }

  return `${dateLabel}: ${durationText} studied`;
}

/**
 * Backward compatibility: Activity color classifier
 */
export function getActivityColorClass(minutes = 0) {
  if (!minutes || minutes <= 0) {
    return 'bg-slate-800/40 border-slate-700/30 hover:border-slate-500/50';
  }
  if (minutes <= 45) {
    return 'bg-emerald-900/40 border-emerald-800/50 hover:border-emerald-700';
  }
  if (minutes <= 90) {
    return 'bg-emerald-700/60 border-emerald-600/60 hover:border-emerald-500';
  }
  if (minutes <= 180) {
    return 'bg-emerald-500 border-emerald-400/80 hover:border-emerald-300';
  }
  return 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.65)] hover:border-white hover:brightness-110';
}

/**
 * Backward compatibility: Legacy 90-day matrix calculator
 */
export function calculateHeatmapMatrix(dailyActivity = {}, referenceDate = new Date()) {
  const safeActivity = (dailyActivity && typeof dailyActivity === 'object') ? dailyActivity : {};
  const today = new Date(referenceDate);
  const todayDayOfWeek = (today.getDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
  
  const totalSlots = 13 * 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (12 * 7 + todayDayOfWeek));

  const weeks = [];
  let currentWeek = [];
  const monthLabels = [];
  let lastSeenMonth = -1;

  let activeDaysCount = 0;
  let totalMinutes = 0;

  for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + slotIndex);
    
    const year = cellDate.getFullYear();
    const month = String(cellDate.getMonth() + 1).padStart(2, '0');
    const day = String(cellDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = (cellDate.getDay() + 6) % 7;

    const currentMonthIndex = cellDate.getMonth();
    const colIndex = Math.floor(slotIndex / 7);
    if (dayOfWeek === 0 && currentMonthIndex !== lastSeenMonth) {
      monthLabels.push({
        colIndex,
        label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(cellDate)
      });
      lastSeenMonth = currentMonthIndex;
    }

    const isFuture = cellDate.getTime() > today.getTime() + (24 * 60 * 60 * 1000 - 1);
    const isToday = cellDate.toDateString() === today.toDateString();
    const minutes = isFuture ? 0 : (Number(safeActivity[dateStr]) || 0);

    if (!isFuture && minutes > 0) {
      activeDaysCount++;
      totalMinutes += minutes;
    }

    const tooltipText = formatHeatmapTooltip(dateStr, minutes);
    const colorClass = isFuture 
      ? 'bg-theme-surface/20 border-theme-border/20 opacity-30 cursor-not-allowed' 
      : getActivityColorClass(minutes);

    currentWeek.push({
      dateStr,
      dayOfWeek,
      colIndex,
      isFuture,
      isToday,
      minutes,
      tooltipText,
      colorClass
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  let calculatedStreak = 0;
  for (let i = 0; i < 90; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const y = checkDate.getFullYear();
    const m = String(checkDate.getMonth() + 1).padStart(2, '0');
    const d = String(checkDate.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    const dayMins = Number(safeActivity[key]) || 0;

    if (i === 0 && dayMins === 0) {
      continue;
    }

    if (dayMins > 0) {
      calculatedStreak++;
    } else {
      break;
    }
  }

  return {
    weeks,
    activeDaysCount,
    currentStreak: calculatedStreak,
    totalMinutes,
    monthLabels
  };
}
