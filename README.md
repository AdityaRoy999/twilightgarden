# Twilight Garden 🌸

### Your Personal Menstrual Health Companion

Twilight Garden is a beautifully designed, privacy-focused menstrual health application that helps you track your cycle, understand your symptoms, and gain personalized insights into your body's rhythm.

![Twilight Garden Banner](public/twilight.png)

## ✨ Key Features

- **Cycle Tracking & Prediction**: Log your period dates and get smart predictions for your next cycle, fertile window, and ovulation.
- **Symptom & Mood Logging**: Detailed daily logs for flow intensity, physical symptoms, and emotional well-being.
- **Smart Insights**: Visual charts and analysis of your cycle history, symptom trends, and phase-specific advice.
- **Doctor's Report**: Generate a professional PDF medical report summarizing your last 6 months of health data.
- **Today's Report Card**: Create and share beautiful daily summary cards (PNG/PDF) with a gradient aesthetic.
- **Privacy First**: Secure authentication and local-first performance optimizations.
- **Notifications**: Smart reminders for period start, ovulation, and daily logging.

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS (Custom Design System)
- **State Management**: React Context API
- **Backend / Auth**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Charts**: Recharts
- **PDF/Image Generation**: jsPDF, html2canvas
- **Animations**: Framer Motion

## 🚀 Getting Started

### Prerequisites

- Node.js 22.12+ (Node 22.14.0 was used for the October 2026 audit), or a compatible version listed in `package.json`.
- npm
- A configured Supabase project. The app requires its URL and anon/publishable key even to render; there is no standalone demo mode.

### Installation

1.  **Clone the repository**

    ```bash
    # Open your existing twilightgarden checkout.
    ```

2.  **Install dependencies**

    ```bash
    npm ci
    ```

3.  **Set up Environment Variables**
    If `.env` already exists, retain it. Otherwise copy `.env.example` to `.env` and set:

    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

    `VITE_` values are browser configuration. Never prefix administrator, service-role, AI-provider, or search-provider secrets with `VITE_`. Release scripts read `SUPABASE_SERVICE_ROLE_KEY`. Edge Functions need their own deployed secrets; the root `.env` does not configure the hosted functions.

4.  **Run the Development Server**
    ```bash
    npm run dev:local
    ```
    Open [http://localhost:3000](http://localhost:3000). This command binds to the local machine and fails if port 3000 is occupied.

5. **Check the project**

    ```bash
    npm run build
    npm test
    npm audit
    ```

    `npm run build` includes TypeScript validation. The repaired lockfile has zero npm audit findings. See [the repair status](docs/REPAIR_STATUS_2026-10-25.md) for tested fixes and outstanding security/platform work; [the original audit](docs/PROJECT_AUDIT_2026-10-25.md) records the earlier 39 type errors and 33 audit findings.

The browser uses the configured hosted Supabase backend. `supabase/config.toml` configures functions; the migration directory mirrors deployed history, including the current repairs. That history is not yet a verified empty-database bootstrap. Do not run loose setup/repair SQL against an existing database.

## 📱 Project Structure

```
App.tsx              # Router, providers, guards, platform callbacks
index.tsx            # Browser entry
index.html           # HTML shell; Tailwind is compiled through PostCSS
index.css            # Theme variables and global styles
components/          # UI, modals, layouts, icons
contexts/            # Auth, data, couples, calls, theme, administration
lib/                 # Supabase, encryption, notifications, calculations, exports
pages/               # Tracking, partner, admin, wellness, and game screens
types.ts             # Application types; DB types in lib/database.types.ts
supabase/            # Edge Functions, deployed migration history, legacy snippets
src-tauri/           # Windows/desktop wrapper
remotion/            # Separate tutorial-video project with its own dependencies
scripts/             # Release and maintenance scripts
docs/                # Audit, evidence, and upgrade priorities
```

## 🎨 Color Palette

| Color       | Hex       | Usage                    |
| ----------- | --------- | ------------------------ |
| **Primary** | `#C33367` | Main buttons and highlights |
| **Teal**    | `#4ECDC4` | Fertility Window         |
| **Lavender** | `#BA90F8` | Ovulation estimates |
| **Purple**  | `#7C3AED` | Insights & Magic         |
| **Dark Bg** | `#19101E` | Dark-mode background |

UI icons are local SVGs in `components/ui/Icons.tsx`. Shared motion presets live in `lib/motion.ts`; reference palettes and surface rules live in `styles/`. White mode is the default.

Run `npm run design:preview` for 56 static page layouts in both appearances and `npm run verify:ui` to inspect the CSS served by localhost. The opt-in `npm run verify:api` creates and cleans synthetic accounts and requires the server-only service role key. See [the latest UI/API verification](docs/DARK_MOTION_AND_API_2026-10-27.md) for evidence and limits.

## 📄 License

No LICENSE file is currently checked into this repository. Confirm the intended license before distribution.

---

_Verified by Twilight Garden Team_ 🌷
