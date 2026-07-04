export type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
};

export type TelegramWebApp = {
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  viewportHeight?: number;
  stableViewportHeight?: number;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (eventType: "themeChanged" | "viewportChanged", eventHandler: () => void) => void;
};

type CssToken =
  | "--app-bg"
  | "--panel"
  | "--panel-strong"
  | "--text"
  | "--muted"
  | "--line"
  | "--accent"
  | "--accent-text"
  | "--control-bg"
  | "--sheet-bg"
  | "--card-bg"
  | "--segmented-bg"
  | "--list-bg"
  | "--route-bg"
  | "--tooltip-bg"
  | "--tooltip-text"
  | "--handle";

type ThemeRuntime = {
  webApp: TelegramWebApp | null;
  refreshViewport(): void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTheme(options: { onViewportChange: () => void }): ThemeRuntime {
  applyDebugThemeFromUrl();

  const webApp = window.Telegram?.WebApp ?? null;
  if (!webApp) {
    return { webApp: null, refreshViewport: () => undefined };
  }

  const refreshViewport = (): void => applyTelegramViewport(webApp);

  safeTelegramCall("apply theme", () => applyTelegramTheme(webApp));
  safeTelegramCall("apply viewport", refreshViewport);
  safeTelegramCall("expand", () => webApp.expand?.());
  safeTelegramCall("disable vertical swipes", () => webApp.disableVerticalSwipes?.());
  safeTelegramCall("ready", () => webApp.ready?.());
  safeTelegramCall("subscribe theme changes", () => {
    webApp.onEvent?.("themeChanged", () => {
      safeTelegramCall("handle theme change", () => applyTelegramTheme(webApp));
    });
  });
  safeTelegramCall("subscribe viewport changes", () => {
    webApp.onEvent?.("viewportChanged", () => {
      safeTelegramCall("handle viewport change", () => {
        refreshViewport();
        options.onViewportChange();
      });
    });
  });
  document.documentElement.dataset.telegram = "true";

  return { webApp, refreshViewport };
}

export function buildTelegramTokens(params: TelegramThemeParams): Partial<Record<CssToken, string>> {
  const panel = params.section_bg_color ?? params.secondary_bg_color ?? params.bg_color;
  const panelStrong = params.secondary_bg_color ?? panel;
  const text = params.text_color;
  const muted = params.hint_color;

  return compactTokens({
    "--app-bg": params.bg_color,
    "--panel": panel,
    "--panel-strong": panelStrong,
    "--text": text,
    "--muted": muted,
    "--line": alphaColor(muted ?? text, 0.28),
    "--accent": params.button_color,
    "--accent-text": params.button_text_color,
    "--control-bg": alphaColor(panel, 0.96),
    "--sheet-bg": alphaColor(panel, 0.97),
    "--card-bg": alphaColor(panelStrong ?? panel, 0.82),
    "--segmented-bg": alphaColor(panelStrong ?? panel, 0.82),
    "--list-bg": alphaColor(panel, 0.88),
    "--route-bg": alphaColor(panelStrong ?? panel, 0.86),
    "--tooltip-bg": alphaColor(panel, 0.94),
    "--tooltip-text": text,
    "--handle": alphaColor(muted ?? text, 0.55),
  });
}

export function alphaColor(color: string | undefined, alpha: number): string | undefined {
  if (!color) return undefined;

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return color;

  const normalized = hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}

function applyDebugThemeFromUrl(): void {
  const theme = new URLSearchParams(window.location.search).get("theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  }
}

function applyTelegramTheme(webApp: TelegramWebApp): void {
  const theme = webApp.themeParams;
  if (!theme) return;

  for (const [name, value] of Object.entries(buildTelegramTokens(theme))) {
    setCssVar(name as CssToken, value);
  }
  if (webApp.colorScheme) document.documentElement.style.colorScheme = webApp.colorScheme;

  safeTelegramCall("set background color", () => {
    if (theme.bg_color) webApp.setBackgroundColor?.(theme.bg_color);
  });
  safeTelegramCall("set header color", () => {
    const headerColor = theme.section_bg_color ? "secondary_bg_color" : "bg_color";
    webApp.setHeaderColor?.(headerColor);
  });
}

function applyTelegramViewport(webApp: TelegramWebApp): void {
  const height = webApp.stableViewportHeight ?? webApp.viewportHeight;
  if (height && Number.isFinite(height)) {
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  }
}

function setCssVar(name: CssToken, value: string | undefined): void {
  if (value) document.documentElement.style.setProperty(name, value);
}

function compactTokens(tokens: Partial<Record<CssToken, string | undefined>>): Partial<Record<CssToken, string>> {
  return Object.fromEntries(Object.entries(tokens).filter((entry): entry is [CssToken, string] => !!entry[1]));
}

function safeTelegramCall(label: string, action: () => void): void {
  try {
    action();
  } catch (error) {
    console.warn(`Telegram WebApp ${label} failed:`, error);
  }
}
