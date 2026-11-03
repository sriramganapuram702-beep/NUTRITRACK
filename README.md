# 🥑 NutriTrack — Food, Nutrition & Fitness Tracker

NutriTrack is a modern, responsive, full-stack personal nutrition and fitness tracking application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **SQLite**.

---

## ✨ Features

- **🔐 Passwordless OTP Authentication**:
  - Secure 6-digit email OTP with rate limiting, attempt throttling, and tamper-resistant SHA-256 salted hashing.
- **🎯 Personalized Nutrition Blueprint (Mifflin-St Jeor)**:
  - First-time onboarding calculating BMR, TDEE, Calories, Protein, Carbohydrates, Healthy Fats, Dietary Fibre, Water, and Steps.
- **📊 Animated Dashboard**:
  - Live progress bars, macro breakdown cards, circular Daily Goal Completion metric, and dynamic time-based greetings.
- **📖 Daily Food Journal**:
  - Track across 6 meal categories (*Breakfast, Morning Snack, Lunch, Evening Snack, Dinner, Other*).
  - Search 50+ pre-seeded nutritional items with automatic unit conversions (*grams, pieces, cups, servings, ml*).
  - AI photo analysis estimation with meal checklist and portion sliders.
- **💧 Hydration & 👟 Step Trackers**:
  - Quick-log buttons, custom increments, and progress toward daily targets.
- **📋 End-of-Day Daily Food Audit**:
  - Formal submission generating day snapshot, audit remarks, adherence scoring, and status badges (🟢 / 🟡 / 🔴).
- **📅 Tracking Calendar & 📈 Monthly Analytics**:
  - Interactive monthly calendar with adherence status.
  - Interactive Recharts data visualization: weight trends, caloric balance, macronutrient compliance, and step consistency.
- **🌗 Dark / Light Mode**:
  - Clean UI with seamless theme switching via `next-themes`.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Charts**: Recharts
- **Database**: Native Node.js SQLite (`node:sqlite`) with WAL mode
- **Theme**: `next-themes`

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v25 recommended)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/nutritrack.git
   cd nutritrack
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the production build & start**:
   ```bash
   npm run build
   npm start
   ```
   Or run the development server:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## ☁️ Deployment

### Option 1: Vercel (Recommended for Next.js)
1. Push this repository to GitHub.
2. Sign in to [Vercel](https://vercel.com/) with GitHub.
3. Click **"Add New"** > **"Project"** and select your `nutritrack` repository.
4. Deploy!
*(Note: If deploying on serverless platforms, consider replacing local SQLite with Turso, Supabase, or PostgreSQL for persistent cloud storage).*

### Option 2: Render / Railway / Self-Hosted VPS
- Deploy as a persistent Node.js container or server to preserve local SQLite database files (`data/nutritrack.db`).

---

## 📄 Non-Medical Disclaimer

NutriTrack provides estimated nutritional metrics based on standard mathematical formulas (such as Mifflin-St Jeor). All values, macronutrient distributions, and observations are for informational and lifestyle tracking purposes only and do not constitute certified medical advice, clinical diagnosis, or prescriptive dietary regimens.
