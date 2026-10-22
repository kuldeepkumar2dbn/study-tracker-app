# StudyFlow - Personal Daily Study & Skill Tracker

A clean, responsive single-page web app built with **React**, **Vite**, and **Tailwind CSS**. StudyFlow provides academic curriculum tracking, live exam countdowns, deliberate skill progression, spaced repetition revision, a Pomodoro timer, and **direct client-side Google Drive API (v3) synchronization** with zero backend required.

---

## 🚀 Key Modules & Features

### 1. 📚 Subjects Tracker & Curriculum Architecture
- **Subject Creation**: Add subjects with customized color tags, target weekly hours, and upcoming exam dates.
- **Topic Statuses**: Track topics across three states: `"Not Started"`, `"In Progress"`, and `"Mastered"`.
- **Live Completion Bar**: Computes dynamic weighted progress for each subject.
- **Direct Drive File Attachments**: Upload lecture PDFs or handwritten note images directly to your Google Drive `MyStudyTracker_Data` folder and open them directly from your subject notes.

### 2. 🎯 Exam & Deadline Radar
- **Chronological Sorting**: Upcoming exams sorted by proximity to test day.
- **Dynamic Urgency Badges**: Real-time badges (`Urgent! (Today)`, `Tomorrow`, `Urgent! (X Days)`, `In X Days`).
- **Subject Filtering & Completion**: Filter by course or toggle between active radar and archived exams.

### 3. 🧠 Spaced Repetition Revision Queue
- **Ebbinghaus Forgetting Curve**: Automated repetition intervals on **D+1**, **D+3**, **D+7**, and **D+30**.
- **Interactive Checkoffs**: Marking a topic complete automatically calculates and schedules the next review date.

### 4. 🏆 Skill Progression & Deliberate Practice
- **1–5 Level Slider**: Visual proficiency tiers (Level 1: Novice to Level 5: Expert) with mastery percentage progress bars.
- **Milestone & Project Logger**: Differentiate between practical projects and academic milestones.
- **Practice Hours Log**: Quick `+1h` and `+2h` buttons to log deliberate practice.

### 5. ⏱️ Pomodoro Focus Timer
- **Presets**: 25m Focus, 5m Break, 50m Deep Focus.
- **Circular Animated Countdown**: Interactive SVG ring with Start, Pause, and Reset controls.
- **Automatic Subject Crediting**: When a focus session finishes, the logged minutes are automatically added to that subject's studied hours.
- **Synthesizer Ambient Noise**: Web Audio API ambient noise generator (Rain, Rumble, White Noise) with zero external audio assets.

### 6. 🎨 4-Theme Engine
- **`light`**: Clean slate and crisp white for daylight clarity.
- **`dark`**: Neutral zinc and dark gray for relaxed evening viewing.
- **`oled`**: Pure black (`#000000`) for high contrast and battery savings.
- **`nord`**: Arctic Nord cool slate blue palette.
- **Persistence**: Theme saved in `localStorage` and synchronized with Tailwind's `dark` class and CSS variables.

### 7. ☁️ Direct Client-Side Google Drive API (Zero-Backend)
- Authenticates directly via **Google Identity Services (GIS)** OAuth2 with scope `https://www.googleapis.com/auth/drive.file`.
- Automatically checks for or creates the dedicated folder **`MyStudyTracker_Data`** in your Drive.
- Serializes and synchronizes your entire study tracker state to **`study_data.json`**.
- Seamless fallback to `localStorage` when offline or disconnected.

---

## 🛠️ Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-username/studyflow.git
cd studyflow

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173/` in your browser.

---

## 🔑 Free Google Cloud OAuth Client ID (2 Minutes)

To enable client-side Google Drive sync and PDF uploads:

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a free project (e.g., `StudyFlow-App`).
2. Go to **APIs & Services > Library** and search for **Google Drive API**, then click **Enable**.
3. Go to **APIs & Services > OAuth consent screen**:
   - User Type: **External**
   - App name: `StudyFlow`
   - User support email: your email
   - Scopes: add `.../auth/drive.file`
   - Test users: add your own Gmail address
4. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - For local development: `http://localhost:5173`
     - For production: `https://your-app.vercel.app` (or your GitHub Pages URL)
5. Copy your **Client ID** (e.g. `123456789-abcdef.apps.googleusercontent.com`).
6. Click the **Connect Drive** button in the StudyFlow navbar, paste your Client ID, and click **Authorize**.

---

## ⚡ Free Deployment Guide (Under 2 Minutes)

### Option A: Deploy to Vercel (Recommended)

1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of StudyFlow"
   git branch -M main
   git remote add origin https://github.com/your-username/studyflow.git
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com/) and sign in with GitHub.
3. Click **Add New > Project** and select your `studyflow` repository.
4. Framework Preset will be automatically detected as **Vite**.
5. Click **Deploy**.
6. In ~30 seconds, your site is live with a free HTTPS domain (e.g. `https://studyflow-xyz.vercel.app`)!

*Tip*: Add `https://studyflow-xyz.vercel.app` to your Google Cloud Console's **Authorized JavaScript origins** so Drive sync works on production.

---

### Option B: Deploy to GitHub Pages

1. Install the `gh-pages` package:
   ```bash
   npm install --save-dev gh-pages
   ```
2. In `vite.config.js`, add `base: './'` or `base: '/studyflow/'`:
   ```javascript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     base: './'
   });
   ```
3. In `package.json`, add deployment scripts:
   ```json
   "scripts": {
     "dev": "vite",
     "build": "vite build",
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
4. Run:
   ```bash
   npm run deploy
   ```
5. In your GitHub repository settings, go to **Pages** and confirm the source branch is set to `gh-pages`. Your app will be live at `https://your-username.github.io/studyflow/`.

---

## 🔒 Security & Privacy

StudyFlow is built with a strict **Zero-Backend Architecture**:
- All OAuth requests are negotiated directly between your browser and Google Identity Services.
- Study state and uploaded files reside solely in your personal Google Drive and local browser storage.
- No analytics trackers or middleman backend servers exist.
