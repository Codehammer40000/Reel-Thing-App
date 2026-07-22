# The Reel Thing

Swipe on movies and TV shows with your partner until you find a match.

## Quick start (local)

1. **Install dependencies**

```bash
npm install
```

2. **Build the title deck from your CSVs**

```bash
npm run build:titles
```

3. **Configure Firebase**

- Create a project at [Firebase Console](https://console.firebase.google.com/)
- Enable **Authentication → Sign-in method → Email/Password**
- Create a **Firestore** database (start in production mode, then paste rules from `firestore.rules`)
- Add a **Web** app and copy the config values
- Copy `.env.example` → `.env` and fill in the `VITE_FIREBASE_*` values

4. **Run the app**

```bash
npm run dev
```

## How pairing works

1. Each person **creates an account** with a unique alphanumeric display name and a password (6+ characters).
2. On another phone or browser, use **Sign in** with the same name + password.
3. One person types the other’s display name on the Sync screen.
4. Swipes sync under a shared couple document. Mutual **Yup** or either person’s **You Gotta See It** creates a match splash and saves to Matches.

### Migrating from old anonymous accounts

Name-only accounts (no password) won’t work with Sign in. In Firestore, delete old docs under `users/` (and related `couples/` if you want a clean slate), then create fresh accounts with passwords.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Add repository secrets for each `VITE_FIREBASE_*` value (same names as in `.env`).
4. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).

Optional local deploy without Actions:

```bash
npm run deploy
```

(Uses `gh-pages`; requires GitHub auth.)

## Firestore rules

Paste the contents of [`firestore.rules`](firestore.rules) into Firebase Console → Firestore → Rules → Publish.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Vite server |
| `npm run build:titles` | Merge/dedupe CSVs → `public/titles.json` |
| `npm run build` | Titles + TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run deploy` | Publish `dist/` via gh-pages |

## CSV sources

The deck is built from:

- `IMDb_Top_250_Movies.csv`
- `IMDb_Top_250_TV_Shows.csv`
- `IMDb_Top_100_Most_Popular_Movies.csv`
- `IMDb_Top_100_Most_Popular_TV_Shows.csv`

Titles are deduped by IMDb Title ID and tagged with which list(s) they came from.
