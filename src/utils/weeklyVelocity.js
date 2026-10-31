/**
 * Weekly Velocity Benchmark Utilities (src/utils/weeklyVelocity.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Monday - Sunday week boundary accumulator
 * 2. Real-time synchronization between todayLoggedHours and dailyActivity[todayStr]
 * 3. Immediate reflection of today's study hours in the weekly accumulator
 * 4. Formula:
 *    - totalHours = (accumulatedMinutes / 60).toFixed(1)
 *    - percent = Math.min(100, Math.round((totalHours / targetHours) * 100))
 * 5. updateWeeklyVelocityBenchmark() DOM updater for real-time reactivity
 */

/**
 * Reads live user data from LocalStorage
 * @returns {Object} Live user data with dailyActivity and todayLoggedHours
 */
export function getLiveUserData() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { dailyActivity: {}, todayLoggedHours: 0.0, weeklyVelocityHours: 0.0 };
  }
  try {
    const rawProfile = localStorage.getItem('study_user_profile');
    const profile = rawProfile ? JSON.parse(rawProfile) : {};
    const userId = profile.id || profile.email;
    if (userId) {
      const masterRaw = localStorage.getItem(`studyflow_${userId}_data`);
      if (masterRaw) {
        const parsed = JSON.parse(masterRaw);
        return {
          ...parsed,
          dailyActivity: (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') ? parsed.dailyActivity : {},
          todayLoggedHours: Number(parsed.todayLoggedHours) || 0.0,
          weeklyVelocityHours: Number(parsed.weeklyVelocityHours) || 0.0
        };
      }
    }
    const guestRaw = localStorage.getItem('studyflow_guest_data');
    if (guestRaw) {
      const parsed = JSON.parse(guestRaw);
      return {
        ...parsed,
        dailyActivity: (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') ? parsed.dailyActivity : {},
        todayLoggedHours: Number(parsed.todayLoggedHours) || 0.0,
        weeklyVelocityHours: Number(parsed.weeklyVelocityHours) || 0.0
      };
    }
  } catch (e) {
    console.warn('Error reading live user data for weekly velocity:', e);
  }
  return { dailyActivity: {}, todayLoggedHours: 0.0, weeklyVelocityHours: 0.0 };
}

/**
 * Computes Weekly Velocity Benchmark (Monday - Sunday Accumulator).
 *
 * @param {Object} userData Student dataset with dailyActivity and todayLoggedHours
 * @param {number} targetHours Weekly goal target in hours (default 20)
 * @param {Date} now Reference date for calculating current week boundaries
 * @returns {Object} Computed weekly velocity stats and 7-day breakdown
 */
export function calculateWeeklyVelocityBenchmark(userData = {}, targetHours = 20, now = new Date()) {
  const target = Number(targetHours) > 0 ? Number(targetHours) : 20;

  // 3. FIX WEEK BOUNDARY CALCULATION:
  // Ensure the week starts strictly on Monday:
  const distanceToMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);

  // Today's date string in YYYY-MM-DD
  const todayStr = (now instanceof Date ? now : new Date()).toLocaleDateString('en-CA');

  // Ensure dailyActivity object exists
  if (!userData.dailyActivity || typeof userData.dailyActivity !== 'object') {
    userData.dailyActivity = {};
  }

  let accumulatedMinutes = 0;
  const days = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Iterate exactly 7 days from monday to ensure Saturday and Sunday are counted within the same accumulator block
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA');

    let mins = Number(userData.dailyActivity[dateStr]) || 0;

    // Check if the day in the loop matches today's date
    if (dateStr === todayStr) {
      const todayLoggedMins = Math.round((Number(userData.todayLoggedHours) || 0) * 60);
      mins = Math.max(mins, todayLoggedMins);
      // Update userData.dailyActivity[todayStr] immediately with this value so both data points remain in sync
      userData.dailyActivity[todayStr] = mins;
    }

    accumulatedMinutes += mins;
    const hours = Math.round((mins / 60) * 10) / 10;
    days.push({
      dateStr,
      day: dayNames[i],
      minutes: mins,
      hours,
      isToday: (dateStr === todayStr)
    });
  }

  // Calculate total hours: (accumulatedMinutes / 60).toFixed(1)
  const totalWeeklyHours = (accumulatedMinutes / 60).toFixed(1);
  const totalHoursNum = Number(totalWeeklyHours);

  // Calculate percentage: Math.min(100, Math.round((totalHours / targetHours) * 100))
  const percent = Math.min(100, Math.round((totalHoursNum / target) * 100));

  userData.weeklyVelocityHours = totalHoursNum;

  return {
    accumulatedMinutes,
    totalWeeklyHours,
    totalHours: totalHoursNum,
    targetHours: target,
    percent,
    days,
    mondayStr: monday.toLocaleDateString('en-CA'),
    todayStr
  };
}

/**
 * Real-time updater for Weekly Velocity Benchmark widget
 * Updates DOM text and progress bar width directly and returns computed stats.
 *
 * @param {Object} userData Optional user data override
 * @param {number} targetHours Optional target hours override
 * @returns {Object} Computed weekly velocity stats
 */
export function updateWeeklyVelocityBenchmark(userData, targetHours = 20) {
  const effectiveUserData = userData || getLiveUserData();
  const target = targetHours || effectiveUserData?.settings?.weeklyTargetHours || effectiveUserData?.weeklyTargetHours || 20;
  const result = calculateWeeklyVelocityBenchmark(effectiveUserData, target);

  if (typeof document !== 'undefined') {
    // 2. REAL-TIME UI UPDATE:
    // Update text: `${totalWeeklyHours}h / ${targetHours}h (${percent}%)`
    const textEls = document.querySelectorAll(
      '[data-weekly-velocity-text], #weekly-velocity-text, .weekly-velocity-text'
    );
    textEls.forEach(el => {
      el.textContent = `${result.totalWeeklyHours}h / ${result.targetHours}h (${result.percent}%)`;
    });

    // Update progress bar width: `style.width = percent + '%'`
    const barEls = document.querySelectorAll(
      '[data-weekly-velocity-bar], #weekly-velocity-bar, .weekly-velocity-bar'
    );
    barEls.forEach(el => {
      el.style.width = result.percent + '%';
    });
  }

  return result;
}

