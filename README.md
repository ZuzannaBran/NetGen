# NetGen

**Contact and professional networking manager**

NetGen is a web application for recording professional contacts, organizing
introductions and events, and exploring relationships through an interactive
network graph. The interface is designed for desktop and mobile browsers and
can be installed as a Progressive Web App (PWA).

## Features

- **Contact management:** create, edit, search, list, and delete contacts with
  notes, tags, contact methods, and source information.
- **Network visualization:** explore contacts and the events or people that
  introduced them using an interactive graph.
- **Event records:** maintain event descriptions and find related contacts.
- **Authentication:** email/password and Google sign-in through Firebase
  Authentication.
- **Personal data separation:** Firestore rules restrict each account to its
  own records.
- **PWA:** installable app shell with service-worker caching of static assets.
  Contact data requires a network connection unless a separate Firestore
  offline-persistence feature is configured.

## Technology

| Area | Technology |
| --- | --- |
| Client | JavaScript (ES modules), HTML, CSS |
| Build / PWA | Vite, vite-plugin-pwa |
| Graphs | force-graph, D3 force |
| Identity and database | Firebase Authentication, Cloud Firestore |
| Hosting | Firebase Hosting |
| Optional feedback delivery | EmailJS or Firebase Cloud Functions with SendGrid |
| Quality checks | ESLint, Prettier, Node.js tests, GitHub Actions |

## Repository layout

```text
.
├── .github/workflows/ci.yml  # Automated quality checks
├── firestore.rules           # Access control for contacts and events
├── firestore.indexes.json    # Firestore indexes
├── firebase.json             # Firebase Hosting / Functions configuration
├── functions/                # Optional feedback API
└── web-app/
    ├── public/               # Static images, policy and app icon
    ├── src/
    │   ├── main.js           # UI and event handlers
    │   ├── services/         # Authentication, data access and graph
    │   ├── utils/            # Shared formatting and escaping
    │   └── style.css
    └── tests/                # Unit tests
```

## Run locally

**Prerequisites:** Node.js 20 or newer, npm, and a Firebase project with
Authentication and Cloud Firestore enabled.

1. Install dependencies and create the local configuration:

   ```bash
   cd web-app
   npm ci
   cp .env.example .env.local
   ```

2. Fill in the `VITE_FIREBASE_*` variables in `web-app/.env.local`
   using **Firebase Console → Project settings → Your apps**. Enable the
   email/password or Google sign-in methods you intend to use. Add the local
   development domain to Firebase Authentication's authorized domains if
   required. Deploy the repository's `firestore.rules` and
   `firestore.indexes.json` before using a shared database.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Vite displays the local URL (normally `http://localhost:5173`).

The Firebase Web App configuration is intentionally client-side. Do **not**
place service-account credentials, SendGrid API keys, or other server secrets
in `VITE_*` environment variables.

## Quality checks

From `web-app/`:

```bash
npm run lint
npm test
npm run build
```

The GitHub Actions workflow runs these checks for pushes and pull requests.
A local production preview is available with `npm run preview`.

## Optional feedback integration

The feedback forms can send mail with EmailJS using
`VITE_EMAILJS_PUBLIC_KEY`, `VITE_EMAILJS_SERVICE_ID`, and
`VITE_EMAILJS_TEMPLATE_ID`. Alternatively, set
`VITE_FEEDBACK_ENDPOINT` to the URL of the `sendFeedback` HTTPS Cloud
Function. The current client prefers EmailJS when both integrations are
configured, and otherwise tries the Cloud Function. If neither is available
or delivery fails, the user can open a prefilled email.

To deploy the Cloud Function, install the dependencies in `functions/`,
configure the SendGrid API key and verified sender/recipient addresses in
Firebase Functions' server-side configuration, then deploy:

```bash
npm ci --prefix functions
firebase functions:config:set sendgrid.key="YOUR_SECRET" \
    sendgrid.from="verified@example.com" \
    sendgrid.to="inbox@example.com"
firebase deploy --only functions:sendFeedback
```

The function uses the legacy Firebase Functions runtime configuration API;
migrate it to environment parameters or Secret Manager before updating to
a runtime that removes `functions.config()`. The public feedback endpoint
also requires production anti-abuse controls (for example, App Check and
server-side rate limiting) before widespread deployment.

## Deployment

Build the web app, then deploy the hosting configuration from the repository
root:

```bash
npm ci --prefix web-app
npm run build --prefix web-app
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore,hosting
```

Firebase Hosting serves `web-app/dist` and rewrites client routes to
`index.html`. Optional Functions deployment is independent of Hosting.

## Privacy and security

Contact and event documents carry an `ownerId` tied to the authenticated
Firebase user. Firestore rules validate this on creation and prevent ownership
changes on update. Do not deploy with permissive Firestore test-mode rules.

See [Data Storage Policy](web-app/public/data-storage-policy.html) for the
application's published data handling statement. Verify the policy matches
your actual deployment and third-party services before publishing the app.

## License

Copyright © 2026 Zuzanna Baran.

Released under the [NetGen Non-Commercial License](LICENSE).
Personal, educational and other non-commercial use is permitted under its
terms; commercial use requires prior written permission. This is **not**
an OSI-approved open-source license.
