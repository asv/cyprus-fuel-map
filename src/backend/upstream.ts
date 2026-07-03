import type { City, FuelType } from "../shared";
import { sourceUrl } from "./parser";

const sourceOrigin = "https://eforms.eservices.cyprus.gov.cy";
const upstreamTimeoutMs = 15_000;

export async function fetchFuelHtml(fuel: FuelType, city: City): Promise<string> {
  return withRetry(async () => {
    const getResponse = await fetchWithTimeout(sourceUrl, {
      headers: { "user-agent": userAgent() },
    });
    if (!getResponse.ok) throw new Error(`Source GET failed: ${getResponse.status}`);

    const getHtml = await getResponse.text();
    const token = getRequestVerificationToken(getHtml);
    const cookie = cookieHeader(getResponse.headers.get("set-cookie") ?? "");
    const action = getFormAction(getHtml);

    const body = new URLSearchParams({
      __RequestVerificationToken: token,
      "Entity.PetroleumType": fuel,
      "Entity.StationCityEnum": city,
      "Entity.StationDistrict": "",
    });

    const postResponse = await fetchWithTimeout(new URL(action, sourceOrigin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": userAgent(),
        referer: sourceUrl,
        cookie,
      },
      body,
    });
    if (!postResponse.ok) throw new Error(`Source POST failed: ${postResponse.status}`);

    return postResponse.text();
  });
}

async function fetchWithTimeout(input: string | URL, init: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(upstreamTimeoutMs) });
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    await Bun.sleep(750);
    try {
      return await operation();
    } catch {
      throw error;
    }
  }
}

function getRequestVerificationToken(html: string): string {
  const match = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (!match?.[1]) throw new Error("Request verification token not found");
  return htmlDecode(match[1]);
}

function getFormAction(html: string): string {
  const match = html.match(/<form[^>]+action="([^"]+)"/i);
  if (!match?.[1]) return "/MCIT/MCIT/PetroleumPrices";
  return htmlDecode(match[1]);
}

function htmlDecode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cookieHeader(setCookie: string): string {
  const cookies = new Map<string, string>();
  for (const name of ["ASP.NET_SessionId_Efef", "__RequestVerificationToken"]) {
    const match = setCookie.match(new RegExp(`${name}=([^;,]+)`));
    if (match?.[1]) cookies.set(name, match[1]);
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function userAgent(): string {
  return "Mozilla/5.0 (compatible; cyprus-fuel-map-local/0.1)";
}
