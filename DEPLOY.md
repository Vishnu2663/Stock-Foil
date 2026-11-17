# Put it online (free, HTTPS)

The phone camera only works on `https://` or `localhost`, so host the built app to let others (and judges) open it on their phones. It is a fully static site: no server, no database, no keys.

## Option A: Netlify Drop (fastest, no account setup beyond a login)
```bash
npm install
npm run build
```
Then drag the `dist/` folder onto https://app.netlify.com/drop. You get an `https://….netlify.app` link.

## Option B: GitHub Pages (automatic on every push)
1. Put this folder in a GitHub repo (the `.github/workflows/pages.yml` file is already here).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Push to `main`. The site appears at `https://<you>.github.io/<repo>/`.

## Option C: Same Wi-Fi, no hosting (testing only)
```bash
npm run build
npx vite preview --host
```
Open the printed Network URL on your phone. Browsers block the camera on plain `http://` network addresses, so use **Choose photos** there, not the live camera.

## After deploying
- Open the site once on each phone while online; it then works offline (PWA).
- Add it to the home screen for an app-like icon.
- The home page shows a QR code of the current address so judges can open it by scanning.
- Nothing you scan leaves the phone. Only the optional AI features make network calls, and only with your own key.
