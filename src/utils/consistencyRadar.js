/**
 * Consistency Radar & Study Heatmap Utilities (src/utils/consistencyRadar.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Tooltip formatting:
 *    - Empty square: "[Date]: No study activity logged"
 *    - Active square: "[Day, Month Date]: X hours Y mins studied"
 * 2. Color classification for 5 intensity scales:
 *    - 0 mins: slate-800/40 (inactive square)
 *    - 1-45 mins: emerald-900/40
 *    - 46-90 mins: emerald-700/60
 *    - 91-180 mins: emerald-500
 *    - 180+ mins: emerald-400 (with glow accent)
 * 3. 90-Day matrix calculation (13 columns x 7 rows for Mon-Sun)
 * 4. Strictly ZERO dummy/mock data; true zero-state hydration directly from userData.dailyActivity
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
  // 180+ mins with vibrant emerald glow
  return 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.65)] hover:border-white hover:brightness-110';
}

/**
 * Calculates 90-day matrix data (13 columns x 7 rows for Mon-Sun)
 * Reads strictly from actual user data; zero synthetic seed values.
 */
export function calculateHeatmapMatrix(dailyActivity = {}, referenceDate = new Date()) {
  const safeActivity = (dailyActivity && typeof dailyActivity === 'object') ? dailyActivity : {};
  const today = new Date(referenceDate);
  const todayDayOfWeek = (today.getDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
  
  const totalSlots = 13 * 7; // 91 slots (13 weeks)
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

  // Calculate actual consecutive streak backwards from today
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
