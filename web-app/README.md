# Networking By Zuzia - Web App

Progressive Web App version of the Contact Networking System with Firebase backend.

## Features

✨ **Full Feature Parity with C Version:**
- 🔍 Search contacts (by ID, name, hashtags, event)
- 📋 List contacts (full or brief)
- 🗑️ Delete contacts (with duplicate detection)
- ➕ Add new contacts with auto-formatting
- 📱 **PWA Support** - Install as native app
- ☁️ **Firebase Cloud Storage** - Access from anywhere
- 🔄 **Offline Support** - Works without internet

## Setup Instructions

### 1. Install Dependencies

```bash
cd web-app
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in **test mode** (for development)
   - Choose a location

4. Get your Firebase config:
   - Go to Project Settings (⚙️ icon)
   - Scroll to "Your apps"
   - Click "Web" (</> icon)
   - Copy the `firebaseConfig` object

5. Update `src/services/firebase.js`:
   - Replace the `firebaseConfig` object with your own

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser

### 4. Build for Production

```bash
npm run build
```

### 5. Deploy to Firebase Hosting (Optional)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Deploy
firebase deploy
```

## Automated Feedback Emails (Firebase Functions + SendGrid)

The "Contact The Creator" form can now call a Firebase HTTPS Function (`functions/index.js`) that sends e‑mails through SendGrid. Follow the steps below once per environment.

### 1. Prepare SendGrid
- Create a free SendGrid account and verify a sender identity (Settings → Sender Authentication → "Verify a Single Sender").
- In SendGrid go to Settings → API Keys → "Create API Key" with "Full Access" to Mail Send; copy it once generated.

### 2. Configure the Firebase Functions workspace
- Install dependencies for the Cloud Function:

   ```bash
   cd functions
   npm install
   ```

- Store the SendGrid secrets in Firebase (never commit them):

   ```bash
   firebase functions:config:set sendgrid.key="YOUR_KEY" \
      sendgrid.from="verified@yourdomain.com" \
      sendgrid.to="baran_zuzanna@outlook.com"
   ```

   (Run inside the repo root so Firebase CLI finds `firebase.json`.)

### 3. What to click in the Firebase console
- Open [Firebase Console](https://console.firebase.google.com/), pick your project, then left menu → **Build → Functions**.
- Click **Get started**, pick the region closest to your users, and confirm the billing warning (Cloud Functions require the Blaze plan, but the free quota usually covers light usage).
- After you deploy (next step), return to this Functions page, click on `sendFeedback`, and copy the **Trigger URL** shown in the right panel.

### 4. Deploy and wire up the frontend
- Deploy the new function:

   ```bash
   firebase deploy --only functions:sendFeedback
   ```

- Copy `web-app/.env.example` to `.env.local` (or `.env`) and paste the trigger URL:

   ```bash
   cp web-app/.env.example web-app/.env.local
   echo VITE_FEEDBACK_ENDPOINT="https://REGION-PROJECT.cloudfunctions.net/sendFeedback" >> web-app/.env.local
   ```

- Restart `npm run dev` (Vite reads env vars on startup). The contact form now POSTs to your Function; it automatically falls back to `mailto:` if the call fails.

### Optional: test locally
- Use the Firebase emulator suite for local tests:

   ```bash
   firebase emulators:start --only functions
   ```

- Point `VITE_FEEDBACK_ENDPOINT` to `http://localhost:5001/<project-id>/<region>/sendFeedback` while the emulator is running.

## Project Structure

```
web-app/
├── src/
│   ├── services/
│   │   ├── firebase.js          # Firebase configuration
│   │   └── contactService.js    # Business logic (from C)
│   ├── utils/
│   │   └── formatters.js        # Text formatting utilities
│   ├── main.js                  # Main app logic
│   └── style.css                # Styling
├── public/                      # Static assets
├── index.html                   # Main HTML
├── package.json                 # Dependencies
└── vite.config.js              # Vite + PWA config
```

## Firebase Firestore Structure

```
contacts (collection)
  └── {auto-generated-id} (document)
      ├── id: number
      ├── name: string
      ├── surname: string
      ├── note: string
      ├── advantage: string
      ├── source_type: string ("event" | "contact" | "")
      ├── source_value: string
      └── hashtags: array<string>
```

## Auto-Formatting Features

Just like the C version:
- **Names & Surnames**: First letter capitalized, rest lowercase
- **Hashtags**: All lowercase
- **Source Values**: First letter capitalized

## PWA Features

- Install on any device (mobile, desktop)
- Offline support with service workers
- Fast loading with caching
- Native app-like experience

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with PWA support

## Notes

⚠️ **Security**: The Firebase config uses test mode. For production:
1. Set up proper Firestore security rules
2. Enable authentication if needed
3. Restrict API keys

## License

MIT
