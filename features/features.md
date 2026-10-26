# 🌺 Twilight Garden — Complete Feature Matrix

_Twilight Garden is a beautifully designed menstrual cycle tracking and couples wellness ecosystem. It runs as a Progressive Web App, native Android app (Capacitor), and Windows desktop app (Tauri). This document defines every feature across four core verticals: The Primary User, The Supporter, The Intelligence, and The Relationship._

> **Important:** A Supabase connection is required to use the app. All user accounts, cycle data, couple pairing, encrypted messaging, notifications, and AI features depend on real-time cloud infrastructure. The app is not offline-first — it requires an active internet connection for core functionality.

---

## 👩🏻‍🦰 The Menstruator (Primary User) Experience

### 🖼️ Core Aesthetic & Interface

- **Seasons Theme Engine**: Dynamic, handcrafted themes built into `index.css` (e.g., _Blush_, _Twilight_, dark/light modes) that recolor the entire interface, including gradients, surfaces, text layers, and navigation.
- **Framer Motion Physics**: The entire application uses spring-based fluid animations. Card morphs, modal entrances, navigation transitions, and page slides all employ `framer-motion` layout animations with soft, bouncy physics.
- **Visual Ergonomics Control**: Global toggle states (`animationsEnabled`, `solidNavBg`) allow users with motion sensitivity to switch to a static, high-visibility mode instantly.
- **Feature Carousel**: An interactive onboarding carousel (`FeatureCarousel.tsx`) showcasing all major features during first launch.
- **Tutorial System**: Built-in contextual tutorials (`TutorialContext.tsx`, `tutorialData.ts`) that guide users through features on first interaction.

### 🔒 Security & Privacy

- **End-to-End Encryption (E2EE)**: All Love Notes (text messages, images, voice messages) between partners are encrypted using **ECDH P-256 key exchange** with AES-GCM. Private keys never leave the device in plaintext. Supabase only stores encrypted blobs.
- **History Unlock**: A device without the account’s canonical identity can browse the app, but must restore that identity before reading encrypted chat or making calls.
- **Cloud Key Backup**: A recovery passphrase protects the identity with AES-GCM and PBKDF2-SHA256. New backups use 600,000 iterations; legacy backups remain readable. This is an application backup, not hardware-backed key storage.
- **Multi-Device Support**: Devices restore the same account identity using a passphrase or a same-account trusted-device code. Removing a device registration does not revoke its auth session or erase copied keys.
- **Identity Lockdown**: `IdentityLockdownPrompt.tsx` opens history recovery when a chat device cannot use the canonical identity.
- **Security Verification**: Partners compare a 60-digit fingerprint or scan a QR code. The UI shows verified only after a matching comparison.
- **Partner Privacy**: The tracker controls relationship-wide health sharing. Separate per-field sharing controls are not implemented.
- **Ghost Mode**: A single toggle (`toggleGhostMode()`) that instantly hides all shared data from the partner without breaking the pairing.

### 📝 Health Tracking & Logging

- **Ambient Cycle Dashboard** (`Dashboard.tsx`): The main screen presents a serene visual of the current cycle phase (Menstrual, Follicular, Ovulation, Luteal) with a countdown prediction to the next period, a cycle day indicator, and quick-action shortcuts.
- **The Daily Log Form** (`LogDetails.tsx`): A comprehensive, flowing input screen covering:
  - **Flow**: Spotting, Light, Medium, Heavy
  - **Moods**: Calm, Happy, Energetic, Frisky, Mood Swings, Anxious, Sad, Irritated
  - **Physical Symptoms**: Cramps, Tender Breasts, Headache, Acne, Backache, Fatigue, Bloating, Insomnia, Nausea, Dizziness, Hot Flashes, Chills, Pelvic Pain, Joint Pain, Sensory Sensitivity
  - **Digestive Symptoms**: Bloating, Cravings, Nausea, Gas, Diarrhea, Constipation, Heartburn, Indigestion, Loss of Appetite
  - **Energy Level**: High, Medium, Low
  - **Sleep Quality**: Good, Fair, Poor
  - **Sleep Hours**: Numeric input
  - **Free-text Notes**: Personal journal entries
- **Today Report Modal** (`TodayReportModal.tsx`): A quick-access modal summarizing all logged data for the current day in a visual card format.
- **Log Details Modal** (`LogDetailsModal.tsx`): Tapping a historical day opens an immersive modal showing the exact snapshot of how the user felt on that day relative to their cycle phase.
- **Historical Archive** (`LogHistory.tsx`): A dynamically loading history view with infinite scroll, toggleable Grid vs. List layouts optimized for mood-scanning or data-reading.
- **Calendar View** (`Calendar.tsx`): A full monthly calendar with color-coded cycle phase overlays, logged day indicators, and day-detail views.
- **Cycle Settings**: Configurable cycle and period length via dedicated settings pages (`CycleLengthSettings.tsx`, `PeriodLengthSettings.tsx`).

### 📊 Insights & Analytics (`Insights.tsx`)

- **Full Recharts Dashboard**: Interactive data visualizations including:
  - Bar Charts for symptom frequency
  - Pie Charts for mood distribution
  - Line Charts for cycle trend tracking
- **Shareability**: Insight cards can be shared via a unique public link (`SharedCard.tsx`) with expiration dates. The share page renders a beautiful, branded card with cycle data, phase, moods, and symptoms visible to anyone with the link.

### 📤 Data Export

- **PDF Health Report** (`exportPDF.ts`): Generates a comprehensive downloadable PDF compiling profile info, cycle settings, and all daily logs.
- **Doctor's Report**: A separate, medically formatted PDF export designed to be presented to healthcare professionals.

### 🧘 Wellness Suite

- **AI Wellness Tips** (`Wellness.tsx`): Personalized wellness advice generated by Gemini AI based on current cycle phase, moods, symptoms, sleep quality, and energy level.
- **Sleep & Energy Correlation** (`analyzeSleepEnergyCorrelations()`): Client-side analysis of logged sleep and energy data to surface patterns and correlations.
- **Breathing Exercises** (`BreathingExercises.tsx`): Three guided breathing techniques with animated visual guides:
  - **Box Breathing**: 4-4-4-4 pattern for calming anxiety
  - **4-7-8 Relaxation**: Natural tranquilizer for the nervous system
  - **Deep Calm**: Simple 5-5 deep breathing for quick relaxation
  - Configurable round count (1–30), animated breathing circle, step indicators, and completion celebration.

### 🔔 Notifications (`notifications.ts`)

- **Local Notifications** (Capacitor): Scheduled daily reminders at multiple times (Morning, Afternoon, Evening, Night) prompting the user to log their day.
- **Period Prediction Reminders**: Automatically scheduled notifications when the predicted period date approaches.
- **Push Notifications** (Firebase Cloud Messaging): Server-driven push for partner messages, game invites, empathy alerts, and more.
- **Desktop Notifications** (Tauri): Native Windows toast notifications via `@tauri-apps/plugin-notification` for partners running the `.exe` app in the background.
- **In-App Notification Bell** (`NotificationBell.tsx`): A notification center with unread count badge, notification types (reminder, period prediction, insight, game invite, chat message, partner log update), and read/unread management.

---

## 💕 Love Notes — End-to-End Encrypted Chat (`LoveLock.tsx`)

The Love Notes feature is a full-featured, WhatsApp-style encrypted messaging system between paired partners.

### 💬 Messaging Features

- **Text Messages**: Full E2EE text messaging with auto-resizing textarea (grows upward, WhatsApp-style).
- **Image Sharing**: Camera capture (on mobile via Capacitor) or gallery picker. Images are encrypted and uploaded to Supabase Storage.
- **Voice Messages** (`AudioRecorder.tsx`): Record and send encrypted voice notes with a dedicated audio recorder UI.
- **GIF Search & Sending**: Integrated Giphy search with trending GIFs. GIF URLs are sent as-is (not encrypted).
- **AI Love Note Generator** (`handleAIGenerate()`): One-tap generation of a romantic love note message powered by Gemini AI, contextually aware of the partner's current cycle phase and moods.
- **Link Detection & Preview**: Automatic detection and rendering of URLs in messages with clickable link previews.

### 🛠️ Message Actions (`MessageContextMenu.tsx`)

- **Reactions**: Emoji reactions on messages (❤️, 😂, 😢, etc.) with real-time sync.
- **Reply-to**: Quote-reply to specific messages with visual threading.
- **Star Messages**: Bookmark important messages for easy retrieval.
- **Pin Messages**: Pin important messages to the top of the conversation.
- **Forward Messages**: Forward a message by re-sending its content as a new message with an `is_forwarded` flag.
- **Delete Messages**: "Delete for me" (soft delete) or "Delete for everyone" (hard delete).
- **Multi-Select Bulk Delete**: Select multiple messages and delete them in batch.
- **Image Download**: Save received images directly to the device.
- **Copy Text**: Copy message text to clipboard.

### 📞 Audio & Video Calling (`CallContext.tsx`, `CallModal.tsx`)

- **WebRTC Peer-to-Peer Calls**: Full audio and video calling between partners using WebRTC.
- **ICE Servers**: Google STUN + ExpressTurn TURN servers (primary) + Metered OpenRelay (fallback) for NAT traversal.
- **Call Controls**: Mute/unmute microphone, toggle video on/off, end call.
- **Call UI**: Full-screen call modal with local/remote video streams, call status indicators, and caller name display.
- **Signaling**: WebRTC signaling via Supabase Realtime broadcast channels for offer/answer/ICE candidate exchange.
- **No Recording**: Calls are peer-to-peer and are **not recorded or stored** by any server.

### 🔗 Couple Pairing

- **Pairing Code System**: The primary user generates a unique pairing code. The partner enters this code to establish the couple link.
- **Love Code Lock**: An optional additional security code required to unlock the Love Notes chat feature.
- **Disconnect**: Either partner can disconnect the couple pairing, which clears all shared data and encryption keys.

---

## 👨‍💼 The Partner (Supporter) Experience

The partner has a fully separate, specialized app environment designed for empathy and support, not data analysis.

### 📡 Secure Onboarding

- **Separate Auth Flow**: Partners have dedicated Sign Up (`PartnerSignUp.tsx`), Login (`PartnerLogin.tsx`), Forgot Password (`PartnerForgotPassword.tsx`), and OAuth callback routes.
- **Pairing Handshake**: The partner inputs the secure pairing code generated by the primary user to establish the couple link.
- **Role Assignment**: Partners are assigned the "supporter" role. Row Level Security prevents partner accounts from modifying the primary user's data.

### 🧠 The Partner Dashboard (`PartnerDashboard.tsx`)

- **Phase Translation Layer**: Instead of raw data, the dashboard provides educational context about what the current cycle phase physically feels like.
- **Live Mood & Symptom Stream**: Real-time updates when the menstruator logs moods, symptoms, or flow changes.
- **Biological Explanations**: Non-medicalized snippets explaining hormonal effects (e.g., _"Energy may be dipping as progesterone rises."_).
- **Relationship Weather** (`RelationshipWeather.tsx`): A visual "weather" indicator summarizing the overall relationship state based on cycle data and recent interactions.

### 📊 Partner-Specific Views

- **Partner Calendar** (`PartnerCalendar.tsx`): A dedicated calendar view showing the menstruator's cycle phases and logged days.
- **Partner Logs** (`PartnerLogs.tsx`): A read-only view of the menstruator's historical health logs.
- **Partner Insights** (`PartnerInsights.tsx`, `PartnerInsightsView.tsx`): Analytics and insights about the menstruator's cycle data, including charts and trend analysis.
- **Partner Wellness** (`PartnerWellness.tsx`): AI-generated empathy alerts and partner-specific wellness guidance.
- **Partner Notifications** (`PartnerNotifications.tsx`): A dedicated notification feed for the partner.
- **Partner Profile** (`PartnerProfile.tsx`): Profile management for the partner account.

### 🔔 Real-Time Communication

- **Supabase Realtime Broadcasts**: All data updates (logs, settings, profile changes) are pushed instantly to the partner via WebSocket broadcast channels in `CouplesContext.tsx`.
- **Sync History** (`SyncHistoryModal.tsx`): A detailed log of all data synchronization events between the menstruator and partner.

---

## 🎮 Couple Games Hub (`Games.tsx`)

A full suite of **19 real-time multiplayer games** designed exclusively for couples, organized into four categories. All games use Supabase Realtime for live turn-by-turn synchronization.

### 🎲 Classic Games

| Game                    | Description                          |
| ----------------------- | ------------------------------------ |
| **Tic Tac Toe**         | Classic X & O with live partner play |
| **Connect Four**        | Drop discs to connect four in a row  |
| **Rock Paper Scissors** | Best of 5 rounds                     |
| **Hangman**             | Guess the word letter by letter      |

### 💕 Couple Games

| Game                     | Description                               |
| ------------------------ | ----------------------------------------- |
| **Love Trivia**          | How well do you really know each other?   |
| **Two Truths & One Lie** | Spot the lie in your partner's statements |
| **Truth or Dare**        | Classic party game for couples            |
| **Would You Rather**     | Tough choices, hilarious answers          |
| **This or That**         | Quick preference picks                    |

### 🧠 Brain Games

| Game              | Description                                       |
| ----------------- | ------------------------------------------------- |
| **20 Questions**  | Yes or no — guess in 20 tries                     |
| **Word Guess**    | Guess the secret word with clues                  |
| **Memory Match**  | Flip cards to find matching pairs                 |
| **Story Builder** | Take turns adding sentences to build a wild story |
| **Riddle Me**     | Solve riddles together                            |

### 🎉 Party Games

| Game                  | Description                         |
| --------------------- | ----------------------------------- |
| **Never Have I Ever** | Confess & discover                  |
| **Emoji Charades**    | Act it out with emojis              |
| **Song Lyrics**       | Complete the song lyrics            |
| **Rapid Fire**        | Quick-answer rounds                 |
| **Dots & Boxes**      | Classic pen-and-paper strategy game |

### Game Infrastructure

- **Real-time Sync**: All games use Supabase Realtime channels for live state synchronization.
- **Game Sessions** (`gameSessions.ts`): Backend session management for active game state.
- **Game Notifications**: Push notifications for game invites, partner's turn, and game results.
- **Game Ended Screen** (`GameEndedScreen.tsx`): A celebratory/results screen at the end of each game.

---

## 🤖 The AI Intelligence Layer

Twilight Garden uses **Google Gemini AI** (via Supabase Edge Functions) not as a chatbot, but as a contextual intelligence engine that transforms raw health data into actionable insight.

### ✨ AI for the Primary User

- **Personalized Wellness Tips** (`generateWellnessTips()`): Context-aware tips based on current cycle phase, cycle day, moods, symptoms, sleep quality, and energy level. Suggestions include phase-specific nutrition, gentle exercise recommendations, and emotional self-care.
- **Sleep & Energy Pattern Analysis** (`analyzeSleepEnergyCorrelations()`): Client-side analysis correlating sleep quality/hours with energy levels over time to surface actionable patterns.

### 🤝 AI for the Partner

- **Empathy Alerts** (`generateEmpathyAlerts()`): Translates the menstruator's current state into actionable coaching prompts for the partner. Example: _"She is likely experiencing rapid energy drops today. Consider taking over dinner responsibilities tonight."_
- **Friction Forecasting**: Preemptively warns the partner of upcoming hormonal shifts before they occur, acting as an emotional buffer. Example: _"The PMS window is likely opening in 48 hours."_

### 🎁 AI Gift Recommendations

- **Gift Idea Generator** (`generateGiftRecommendations()`): Generates contextual gift suggestions based on the menstruator's current phase, moods, and needs.
- **Product Search** (`searchShoppingProducts()`): Uses the **Serper API** to search for real products from Amazon, Flipkart, Nykaa, Myntra, Blinkit, and other sources, returning product titles, links, images, and prices.

### 💌 AI Love Note Generator

- **Contextual Message Generation**: Available inside Love Notes chat — generates romantic, empathetic messages for the partner to send, tailored to the menstruator's current emotional and physical state.

---

## ⚙️ Settings & Account Management (`Settings.tsx`)

- **Profile Editing** (`EditProfile.tsx`): Update name, avatar (upload to Supabase Storage), bio, and status text.
- **Theme Selection**: Switch between available themes (Blush, Twilight, etc.) and dark/light mode.
- **Animations Toggle**: Disable all motion animations for accessibility.
- **Solid Navigation Background Toggle**: Switch between glassmorphism and solid navigation bar.
- **Device Management**: View all registered devices, rename them, and unlink compromised devices.
- **Notification Preferences**: Enable/disable reminders, customize reminder times.
- **Cycle & Period Length Settings**: Update average cycle and period length for more accurate predictions.
- **PDF Export**: Generate and download health reports or doctor-formatted reports.
- **Account Management**: Change password, forgot password flow (`ForgotPassword.tsx`), and logout.
- **Sync History**: View the full synchronization audit log between the user and their partner.

---

## 🏗️ Technical Architecture

### Platforms

- **Progressive Web App (PWA)**: Runs in any modern browser
- **Android** (Capacitor): Native APK with camera, microphone, storage, and push notification access
- **Windows Desktop** (Tauri): Native `.exe` with Rust-based notification routing and auto-updates (`UpdateModal.tsx`)

### Backend Infrastructure

- **Supabase**: Auth, PostgreSQL database, Row Level Security, Storage, Realtime subscriptions, Edge Functions
- **Cloudflare Worker Proxy**: All traffic between the app and Supabase is routed through a Cloudflare Worker to bypass ISP DNS blocks
- **Firebase Cloud Messaging**: Push notification delivery for Android and Web
- **Google Gemini AI**: Server-side AI via Supabase Edge Functions (no PII ever sent)
- **Giphy API**: GIF search and trending feed in Love Notes
- **Serper API**: Product search for gift recommendations
- **TURN/STUN Servers**: ExpressTurn (primary), Metered OpenRelay (fallback), Google STUN for WebRTC call connectivity

### Security

- **E2EE**: ECDH P-256 + AES-GCM for all chat messages, images, and voice notes
- **Row Level Security**: Supabase RLS policies enforcing strict data access boundaries
- **PIN Protection**: Local device PIN lock with PBKDF2-based cloud key backup
- **No Plaintext Storage**: Private keys never transmitted or stored in plaintext
