# Bumper Blobs

Online multiplayer party game (2–4 players, bots fill empty slots). Pure HTML/JS. Players connect directly through WebRTC (PeerJS), so there is no server to run or pay for.

Controls: touch (drag anywhere to steer, Dash button), or WASD / arrow keys + Space.

## GitHub
```bash
git init && git add . && git commit -m "Bumper Blobs"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/bumper-blobs.git
git push -u origin main
```

## Vercel
Add New > Project > import the repo. Framework: **Other**, Output Directory: `public`, then Deploy.

## Play
One person taps **Create room** and shares the link (or the 4-letter code). Friends open it and join. The host taps **Start game**.

## App
- Phone install: open the site, then Install app (Android) / Add to Home Screen (iOS).
- Stores: `npm install`, `npx cap add android` (or `ios`), `npx cap sync`, `npx cap open android`. Change `appId` in `capacitor.config.json` first.

## Notes
- The host's device runs the game, so a laggy host means a laggy match.
- Strict school/office networks can block WebRTC. For a more robust version, add a TURN server in the `new Peer(...)` config, or move to a server such as PartyKit or Colyseus.
