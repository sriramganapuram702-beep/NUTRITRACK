# 🥑 NutriTrack — Food, Nutrition & Fitness Tracker

[![Live 24/7 App](https://img.shields.io/badge/Live%2024%2F7%20App-nutritrack--umber--tau.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://nutritrack-umber-tau.vercel.app)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

> **🌐 Live 24/7 Website**: **[https://nutritrack-umber-tau.vercel.app](https://nutritrack-umber-tau.vercel.app)**  
> NutriTrack is deployed 24/7 on Vercel's global network with real-time email OTP verification delivered straight to your phone and desktop Gmail!

---

## ✨ Features

- **🔐 Real Email OTP Authentication**:
  - Live email OTP delivery powered by Nodemailer & Gmail SMTP with rate limiting, attempt throttling, and tamper-resistant SHA-256 salted hashing.
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
- **Email Delivery**: Nodemailer (Gmail SMTP) + Resend integration
- **Hosting**: Vercel Global Edge Network (24/7 Uptime)

---

## 🚀 Live Access & Quick Start

### 🌐 Access Live (No Installation Needed)
Visit **[https://nutritrack-umber-tau.vercel.app](https://nutritrack-umber-tau.vercel.app)** from any phone, tablet, or PC.

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sriramganapuram702-beep/nutritrack.git
   cd nutritrack
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build & Start Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📄 Non-Medical Disclaimer

NutriTrack provides estimated nutritional metrics based on standard mathematical formulas (such as Mifflin-St Jeor). All values, macronutrient distributions, and observations are for informational and lifestyle tracking purposes only and do not constitute certified medical advice, clinical diagnosis, or prescriptive dietary regimens.
