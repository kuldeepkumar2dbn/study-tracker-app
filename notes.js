/**
 * Google Drive Notes Module
 * Direct client-side Drive API v3 subject folder organization and multipart uploads
 */

import {
  getOrCreateSubjectFolder,
  uploadDirectToDrive,
  uploadFileToDriveFolder,
  getSubjectFolderLink,
  getStoredDriveFolderMap,
  saveStoredDriveFolderMap,
  NOTES_PARENT_FOLDER_NAME,
  DRIVE_FOLDER_MAP_KEY,
  validateUploadedFile
} from './src/services/googleDrive.js';

export {
  getOrCreateSubjectFolder,
  uploadDirectToDrive,
  uploadFileToDriveFolder,
  getSubjectFolderLink,
  getStoredDriveFolderMap,
  saveStoredDriveFolderMap,
  NOTES_PARENT_FOLDER_NAME,
  DRIVE_FOLDER_MAP_KEY,
  validateUploadedFile
};

export default {
  getOrCreateSubjectFolder,
  uploadDirectToDrive,
  uploadFileToDriveFolder,
  getSubjectFolderLink,
  getStoredDriveFolderMap,
  saveStoredDriveFolderMap,
  NOTES_PARENT_FOLDER_NAME,
  DRIVE_FOLDER_MAP_KEY,
  validateUploadedFile
};
