/**
 * StudyFlow Real-Time Leaderboard, Telemetry & Feedback Backend (Code.gs)
 * Deploy as Google Apps Script Web App (Execute as: Me, Access: Anyone)
 *
 * Handles:
 * - POST type="leaderboard_sync": Upserts student @username, targetExam, hours, streak, subjectHours, live presence
 * - GET  type="leaderboard": Returns Top 100 Overall or Subject-Wise rankings JSON with @username & targetExam
 * - POST type="telemetry": Logs anonymous feature usage pings
 * - POST type="feedback": Logs student feedback & bug reports
 */

var LEADERBOARD_SHEET = 'Leaderboard';
var TELEMETRY_SHEET = 'Telemetry';
var FEEDBACK_SHEET = 'Feedback';

var LEADERBOARD_HEADERS = [
  'studentId',
  'displayName',
  'username',
  'targetExam',
  'weeklyHours',
  'totalHours',
  'streak',
  'activeSubject',
  'isLiveNow',
  'subjectHoursJson',
  'optedIn',
  'updatedAt'
];

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
    }
  } else if (sheet.getLastRow() === 0 && headers && headers.length) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDisplayName_(payload) {
  var rawUsername = String(payload.username || '').trim().replace(/^@+/, '');
  if (rawUsername) {
    return '@' + rawUsername;
  }
  var name = String(payload.displayName || '').trim();
  return name || '@scholar';
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var type = String(payload.type || payload.action || 'telemetry');

    if (type === 'leaderboard_sync') {
      return handleLeaderboardSync_(payload);
    }

    if (type === 'feedback') {
      var fbSheet = getOrCreateSheet_(FEEDBACK_SHEET, [
        'timestamp', 'email', 'rating', 'category', 'message'
      ]);
      fbSheet.appendRow([
        new Date().toISOString(),
        String(payload.email || ''),
        Number(payload.rating || 5),
        String(payload.category || ''),
        String(payload.message || '')
      ]);
      return jsonResponse_({ success: true, type: 'feedback' });
    }

    var telSheet = getOrCreateSheet_(TELEMETRY_SHEET, [
      'timestamp', 'visitorId', 'feature', 'device'
    ]);
    telSheet.appendRow([
      new Date().toISOString(),
      String(payload.visitorId || ''),
      String(payload.feature || ''),
      String(payload.device || '')
    ]);
    return jsonResponse_({ success: true, type: 'telemetry' });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

function handleLeaderboardSync_(payload) {
  var sheet = getOrCreateSheet_(LEADERBOARD_SHEET, LEADERBOARD_HEADERS);
  var studentId = String(payload.studentId || '').trim();
  if (!studentId) {
    return jsonResponse_({ success: false, error: 'Missing studentId' });
  }

  var displayName = formatDisplayName_(payload);
  var username = String(payload.username || '').trim().replace(/^@+/, '') ||
    (displayName.charAt(0) === '@' ? displayName.slice(1) : '');
  var targetExam = String(payload.targetExam || '').trim();
  var weeklyHours = Number(payload.weeklyHours || 0);
  var totalHours = Number(payload.totalHours || weeklyHours || 0);
  var streak = Number(payload.streak || 0);
  var activeSubject = String(payload.activeSubject || 'General Studies').trim();
  var isLiveNow = Boolean(payload.isLiveNow);
  var subjectHoursJson = JSON.stringify(payload.subjectHours || {});
  var optedIn = payload.optedIn !== false;
  var updatedAt = String(payload.updatedAt || new Date().toISOString());

  var rowValues = [
    studentId,
    displayName,
    username,
    targetExam,
    weeklyHours,
    totalHours,
    streak,
    activeSubject,
    isLiveNow,
    subjectHoursJson,
    optedIn,
    updatedAt
  ];

  var data = sheet.getDataRange().getValues();
  var existingRowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === studentId) {
      existingRowIdx = i + 1;
      break;
    }
  }

  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return jsonResponse_({
    success: true,
    studentId: studentId,
    displayName: displayName,
    targetExam: targetExam,
    updatedAt: updatedAt
  });
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var type = String(params.type || 'leaderboard');

    if (type !== 'leaderboard') {
      return jsonResponse_({ status: 'ok', service: 'StudyFlow Telemetry & Leaderboard' });
    }

    var mode = String(params.mode || 'overall').toLowerCase();
    var subject = String(params.subject || '').trim();
    var subjectLower = subject.toLowerCase();
    var limit = Math.max(1, Math.min(100, Number(params.limit || 100)));

    var sheet = getOrCreateSheet_(LEADERBOARD_SHEET, LEADERBOARD_HEADERS);
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return jsonResponse_({ rankings: [], mode: mode, subject: subject });
    }

    var nowMs = Date.now();
    var entries = [];

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var optedIn = row[10] !== false && String(row[10]).toLowerCase() !== 'false';
      if (!optedIn) continue;

      var studentId = String(row[0] || '').trim();
      if (!studentId) continue;

      var displayName = String(row[1] || '').trim();
      var username = String(row[2] || '').trim().replace(/^@+/, '');
      if (username && displayName.charAt(0) !== '@') {
        displayName = '@' + username;
      }
      var targetExam = String(row[3] || '').trim();
      var weeklyHours = Number(row[4] || 0);
      var totalHours = Number(row[5] || weeklyHours);
      var streak = Number(row[6] || 0);
      var activeSubject = String(row[7] || 'General Studies').trim();
      var rawIsLive = row[8] === true || String(row[8]).toLowerCase() === 'true';
      var updatedAt = String(row[11] || '');

      // Auto-expire live status if last heartbeat was > 10 minutes ago
      var isLiveNow = rawIsLive;
      if (isLiveNow && updatedAt) {
        var ageMs = nowMs - new Date(updatedAt).getTime();
        if (!isNaN(ageMs) && ageMs > 10 * 60 * 1000) {
          isLiveNow = false;
        }
      }

      var subjectHours = {};
      try {
        subjectHours = JSON.parse(String(row[9] || '{}')) || {};
      } catch (parseErr) {
        subjectHours = {};
      }

      var hours = weeklyHours;
      if (mode === 'subject' && subjectLower) {
        hours = 0;
        var keys = Object.keys(subjectHours);
        for (var k = 0; k < keys.length; k++) {
          var keyLower = String(keys[k]).trim().toLowerCase();
          if (keyLower === subjectLower || keyLower.indexOf(subjectLower) !== -1 || subjectLower.indexOf(keyLower) !== -1) {
            hours = Number(subjectHours[keys[k]] || 0);
            break;
          }
        }
        if (hours <= 0) continue;
      }

      entries.push({
        studentId: studentId,
        displayName: displayName,
        username: username,
        targetExam: targetExam,
        hours: Math.round(hours * 10) / 10,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        streak: streak,
        activeSubject: activeSubject,
        lastSubject: activeSubject,
        isLiveNow: isLiveNow,
        subjectHours: subjectHours,
        updatedAt: updatedAt
      });
    }

    entries.sort(function (a, b) {
      if (b.hours !== a.hours) return b.hours - a.hours;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.displayName.localeCompare(b.displayName);
    });

    return jsonResponse_({
      rankings: entries.slice(0, limit),
      totalParticipants: entries.length,
      mode: mode,
      subject: subject,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse_({ rankings: [], error: String(err) });
  }
}

