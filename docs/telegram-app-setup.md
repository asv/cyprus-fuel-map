# Telegram Mini App Setup

This app is designed to run as a static Telegram Mini App hosted by GitHub Pages.

## 1. Create and publish the GitHub repository

Create a GitHub repository named `cyprus-fuel-map`, then push the local `main` branch:

```bash
gh auth login -h github.com
gh repo create cyprus-fuel-map --public --source=. --remote=origin --push
```

If the repository already exists, add it as the `origin` remote and push:

```bash
git remote add origin git@github.com:<owner>/cyprus-fuel-map.git
git push -u origin main
```

## 2. Enable GitHub Pages

In the GitHub repository:

1. Open **Settings**.
2. Open **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Save the setting.
5. Open **Actions**.
6. Run **Deploy Pages** manually, or push to `main`.

The workflow will:

1. Install dependencies.
2. Fetch fuel snapshots into `public/data/`.
3. Run checks.
4. Build the static app into `dist/`.
5. Deploy `dist/` to GitHub Pages.

Expected URL:

```text
https://<owner>.github.io/cyprus-fuel-map/
```

Verify these URLs after the first successful deploy:

```text
https://<owner>.github.io/cyprus-fuel-map/
https://<owner>.github.io/cyprus-fuel-map/data/manifest.json
https://<owner>.github.io/cyprus-fuel-map/data/stations-1.json
```

## 3. Create the Telegram bot

Open Telegram and start a chat with `@BotFather`.

Create the bot:

```text
/newbot
```

BotFather will ask for:

- Display name: `Cyprus Fuel`
- Username: for example `cyprus_fuel_map_bot`

Store the bot token somewhere safe. This static app does not need the token at runtime, but it may be useful later if a backend or notifications are added.

Optional bot profile setup:

```text
/setdescription
/setabouttext
/setuserpic
```

## 4. Create the Mini App

In `@BotFather`, create a Mini App:

```text
/newapp
```

BotFather will ask for:

- Bot: select the `Cyprus Fuel` bot.
- App title: `Cyprus Fuel`
- Short name: for example `fuel`
- Web App URL: `https://<owner>.github.io/cyprus-fuel-map/`

The app link will look like:

```text
https://t.me/<bot_username>/<app_short_name>
```

Example:

```text
https://t.me/cyprus_fuel_map_bot/fuel
```

## 5. Add a bot menu button

To show the Mini App as the bot's menu button, use:

```text
/setmenubutton
```

Then select:

- Bot: `Cyprus Fuel`
- Button text: `Open Cyprus Fuel`
- Web App URL: `https://<owner>.github.io/cyprus-fuel-map/`

## 6. Test inside Telegram

Open the Mini App link on mobile Telegram.

Check:

- The app opens without browser chrome.
- The top controls are visible.
- The map fills the screen.
- The bottom sheet is scrollable.
- Fuel data loads from `data/stations-*.json`.
- The geolocation button asks for permission only after tapping.
- Telegram theme colors do not make text unreadable.

## Local testing note

Telegram Mini Apps require an HTTPS URL. For the simplest path, test through GitHub Pages.

If local Telegram testing is needed before deployment, expose the local dev server through an HTTPS tunnel and use that tunnel URL in BotFather temporarily.
