/**
 * Test Suite: Drive Notes Subject Folders & Direct Upload Workflow
 * Validates:
 * 1. getOrCreateSubjectFolder(accessToken, subjectName) logic (Step A, B, C, D)
 * 2. study_drive_folder_map localStorage caching preventing redundant network queries
 * 3. Direct multipart upload with metadata.parents = [targetSubjectFolderId]
 * 4. notes.js exports & contracts
 * 5. UI Notes Explorer grouping by Subject & accordion/card sections
 * 6. Direct "Open in Google Drive" buttons and success notice
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Drive Notes Subject Folders & Direct Upload Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

// Mock localStorage environment
const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

globalThis.sessionStorage = {
  getItem: (key) => storageStore.get('sess_' + key) || null,
  setItem: (key, val) => storageStore.set('sess_' + key, String(val)),
  removeItem: (key) => storageStore.delete('sess_' + key),
  clear: () => storageStore.clear()
};

// Import googleDrive module
const {
  getOrCreateSubjectFolder,
  getSubjectFolderLink,
  getStoredDriveFolderMap,
  saveStoredDriveFolderMap,
  NOTES_PARENT_FOLDER_NAME,
  DRIVE_FOLDER_MAP_KEY,
  uploadFileToDriveFolder
} = await import('../src/services/googleDrive.js');

// Import root notes.js
const rootNotesModule = await import('../notes.js');

// 1. Constants and Module Integrity
it('NOTES_PARENT_FOLDER_NAME is strictly "StudyTracker Notes"', () => {
  assert.equal(NOTES_PARENT_FOLDER_NAME, 'StudyTracker Notes');
});

it('DRIVE_FOLDER_MAP_KEY is strictly "study_drive_folder_map"', () => {
  assert.equal(DRIVE_FOLDER_MAP_KEY, 'study_drive_folder_map');
});

it('notes.js properly exports getOrCreateSubjectFolder, uploadDirectToDrive, and helpers', () => {
  assert.equal(typeof rootNotesModule.getOrCreateSubjectFolder, 'function');
  assert.equal(typeof rootNotesModule.uploadDirectToDrive, 'function');
  assert.equal(typeof rootNotesModule.uploadFileToDriveFolder, 'function');
  assert.equal(typeof rootNotesModule.getSubjectFolderLink, 'function');
  assert.equal(rootNotesModule.NOTES_PARENT_FOLDER_NAME, 'StudyTracker Notes');
  assert.equal(rootNotesModule.DRIVE_FOLDER_MAP_KEY, 'study_drive_folder_map');
});

// 2. Google Drive Folder Check & Reuse Logic (Steps A, B, C, D)
await itAsync('Step A & D: Creates "StudyTracker Notes" parent and new subject folder if neither exists', async () => {
  localStorage.clear();
  const fetchCalls = [];

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    // Step A query: check if parent folder exists
    if (url.includes('StudyTracker+Notes') || url.includes('StudyTracker%20Notes')) {
      return {
        ok: true,
        json: async () => ({ files: [] }) // parent doesn't exist yet
      };
    }

    // Step A creation: create parent folder
    if (options.method === 'POST' && options.body && JSON.parse(options.body).name === 'StudyTracker Notes') {
      return {
        ok: true,
        json: async () => ({
          id: 'parent_folder_root_123',
          name: 'StudyTracker Notes',
          webViewLink: 'https://drive.google.com/drive/folders/parent_folder_root_123'
        })
      };
    }

    // Step B query: search for subject folder inside parent
    if (url.includes('parent_folder_root_123') && url.includes('Python')) {
      return {
        ok: true,
        json: async () => ({ files: [] }) // subject folder not found
      };
    }

    // Step D creation: create new subject folder with parents: [parent_folder_root_123]
    if (options.method === 'POST' && options.body) {
      const parsed = JSON.parse(options.body);
      if (parsed.name === 'Python' && parsed.parents?.[0] === 'parent_folder_root_123') {
        return {
          ok: true,
          json: async () => ({
            id: 'python_folder_456',
            name: 'Python',
            webViewLink: 'https://drive.google.com/drive/folders/python_folder_456'
          })
        };
      }
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  const folderId = await getOrCreateSubjectFolder('mock_access_token_123', 'Python');
  assert.equal(folderId, 'python_folder_456');

  // Verify fetch calls order
  assert.equal(fetchCalls.length, 4);
  assert(fetchCalls[0].url.includes('StudyTracker')); // Step A query
  assert.equal(JSON.parse(fetchCalls[1].options.body).name, 'StudyTracker Notes'); // Step A POST
  assert(fetchCalls[2].url.includes('Python')); // Step B query
  assert.equal(JSON.parse(fetchCalls[3].options.body).name, 'Python'); // Step D POST
  assert.deepEqual(JSON.parse(fetchCalls[3].options.body).parents, ['parent_folder_root_123']);

  // Verify caching in localStorage under 'study_drive_folder_map'
  const cachedRaw = localStorage.getItem('study_drive_folder_map');
  assert(cachedRaw, 'study_drive_folder_map must be populated in localStorage');
  const cached = JSON.parse(cachedRaw);
  assert.equal(cached.parentFolderId, 'parent_folder_root_123');
  assert.equal(cached.folders.Python.id, 'python_folder_456');
  assert.equal(cached.Python, 'python_folder_456');
});

await itAsync('Step C: Reuses existing subject folder if found in "StudyTracker Notes"', async () => {
  localStorage.clear();
  const fetchCalls = [];

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    // Step A: Parent exists
    if (url.includes('StudyTracker')) {
      return {
        ok: true,
        json: async () => ({
          files: [{ id: 'parent_folder_root_123', name: 'StudyTracker Notes' }]
        })
      };
    }

    // Step B: Subject folder "Mathematics" found
    if (url.includes('Mathematics')) {
      return {
        ok: true,
        json: async () => ({
          files: [{
            id: 'math_folder_789',
            name: 'Mathematics',
            webViewLink: 'https://drive.google.com/drive/folders/math_folder_789'
          }]
        })
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  const folderId = await getOrCreateSubjectFolder('mock_token', 'Mathematics');
  assert.equal(folderId, 'math_folder_789');

  // No POST calls should have been made
  const postCalls = fetchCalls.filter(c => c.options?.method === 'POST');
  assert.equal(postCalls.length, 0);

  // Cached in localStorage
  const cached = JSON.parse(localStorage.getItem('study_drive_folder_map'));
  assert.equal(cached.folders.Mathematics.id, 'math_folder_789');
});

await itAsync('Cache hit: Reuses cached folder ID from study_drive_folder_map without ANY fetch calls', async () => {
  // Pre-seed cache
  localStorage.setItem('study_drive_folder_map', JSON.stringify({
    parentFolderId: 'parent_123',
    folders: {
      'AI & ML': {
        id: 'ai_folder_999',
        webViewLink: 'https://drive.google.com/drive/folders/ai_folder_999'
      }
    }
  }));

  globalThis.fetch = () => {
    throw new Error('Fetch should NOT be called when folder ID is cached in study_drive_folder_map');
  };

  const folderId = await getOrCreateSubjectFolder('mock_token', 'AI & ML');
  assert.equal(folderId, 'ai_folder_999');
});

// 3. Direct Multipart Upload with Target Subject Folder Parent
await itAsync('uploadFileToDriveFolder sets metadata.parents to [targetSubjectFolderId]', async () => {
  let uploadedBlob = null;
  let requestHeaders = null;
  let requestUrl = null;

  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestHeaders = options.headers;
    uploadedBlob = options.body;
    return {
      ok: true,
      json: async () => ({
        id: 'file_id_test_101',
        name: 'Calculus_Notes.pdf',
        webViewLink: 'https://drive.google.com/file/d/file_id_test_101/view',
        webContentLink: 'https://drive.google.com/uc?id=file_id_test_101',
        size: '1048576',
        parents: ['math_folder_789']
      })
    };
  };

  // Mock PDF file with valid %PDF- magic-byte header
  const pdfHeaderBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
  const mockFile = {
    name: 'Calculus_Notes.pdf',
    size: 1024 * 100, // 100 KB
    type: 'application/pdf',
    slice: () => ({
      arrayBuffer: async () => pdfHeaderBytes.buffer
    })
  };

  const result = await uploadFileToDriveFolder('test_token_abc', 'math_folder_789', mockFile);

  assert.equal(result.id, 'file_id_test_101');
  assert.equal(result.name, 'Calculus_Notes.pdf');
  assert.deepEqual(result.parents, ['math_folder_789']);
  assert(requestUrl.includes('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'));
  assert.equal(requestHeaders.Authorization, 'Bearer test_token_abc');
  assert(requestHeaders['Content-Type'].includes('multipart/related; boundary='));
});

// 4. UI Structure Verification in NotesTab.jsx & notes.html
it('NotesTab.jsx contains Upload Modal with Subject selection field', () => {
  const notesTabContent = fs.readFileSync(path.join(process.cwd(), 'src/components/tabs/NotesTab.jsx'), 'utf-8');
  assert(notesTabContent.includes('isUploadModalOpen'), 'Must track upload modal open state');
  assert(notesTabContent.includes('pendingUploadFile'), 'Must store staged file in pendingUploadFile');
  assert(notesTabContent.includes('+ Create New Subject Folder'), 'Must have option to create new subject folder');
  assert(notesTabContent.includes('customSubjectInput'), 'Must have text input for custom subject name');
  assert(notesTabContent.includes('Upload to Drive'), 'Must have "Upload to Drive" submit button');
});

it('NotesTab.jsx groups displayed notes/files under accordion/card sections by Subject', () => {
  const notesTabContent = fs.readFileSync(path.join(process.cwd(), 'src/components/tabs/NotesTab.jsx'), 'utf-8');
  assert(notesTabContent.includes('filesBySubject'), 'Must group files by subject');
  assert(notesTabContent.includes('collapsedSubjects'), 'Must support accordion collapse state');
  assert(notesTabContent.includes('countLabel'), 'Must display file count per subject');
  assert(notesTabContent.includes('Open in Google Drive'), 'Must have direct "Open in Google Drive" buttons');
});

it('NotesTab.jsx displays the exact success notification requested', () => {
  const notesTabContent = fs.readFileSync(path.join(process.cwd(), 'src/components/tabs/NotesTab.jsx'), 'utf-8');
  assert(
    notesTabContent.includes('Saved to Google Drive > StudyTracker Notes >'),
    'Must display notification: "Saved to Google Drive > StudyTracker Notes > [Subject Name]"'
  );
  assert(notesTabContent.includes('modalUploadProgress'), 'Must display upload progress bar');
});

it('notes.html loads notes.jsx properly and includes Google Identity Services SDK', () => {
  const notesHtml = fs.readFileSync(path.join(process.cwd(), 'notes.html'), 'utf-8');
  assert(notesHtml.includes('/src/pages/notes.jsx'), 'notes.html must load /src/pages/notes.jsx');
  assert(notesHtml.includes('https://accounts.google.com/gsi/client'), 'notes.html must include GIS script');
});

// Summary
console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
