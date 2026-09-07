import { parse } from "node-html-parser";
import type { City, FuelType } from "../shared";

import { sourceUrl } from "./parser";

const sourceOrigin = "https://eforms.eservices.cyprus.gov.cy";
const upstreamTimeoutMs = 30_000;
const upstreamMaxAttempts = 3;
const upstreamMaxBytes = 10 * 1024 * 1024;

/** Fatal upstream size violation: retrying will not make the response smaller. */
class UpstreamResponseTooLargeError extends Error {}

export async function fetchFuelHtml(fuel: FuelType, city: City): Promise<string> {
  return withRetry(async () => {
    const getResponse = await fetchWithTimeout(sourceUrl, {
      headers: { "user-agent": userAgent() },
    });
    if (!getResponse.ok) throw new Error(`Source GET failed: ${getResponse.status}`);

    const getHtml = await textWithLimit(getResponse, "GET");
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

    return textWithLimit(postResponse, "POST");
  });
}

/**
 * Read a response body streaming byte-by-byte and abort as soon as the limit is
 * exceeded. Tests against a fully buffered body are useless: by the time
 * response.text() returned, the memory was already allocated. This read-loop
 * bounds worst-case allocation to upstreamMaxBytes regardless of what the
 * upstream sends, and cancels the reader so the connection is not left dangling.
 */
export async function textWithLimit(response: Response, phase: "GET" | "POST"): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > upstreamMaxBytes) {
    throw new UpstreamResponseTooLargeError(`Upstream ${phase} response too large: ${declaredLength} bytes`);
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > upstreamMaxBytes) {
      await reader.cancel();
      throw new UpstreamResponseTooLargeError(`Upstream ${phase} response exceeds ${upstreamMaxBytes} byte limit`);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString();
}

async function fetchWithTimeout(input: string | URL, init: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(upstreamTimeoutMs) });
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= upstreamMaxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      // An oversized response is not transient; re-fetching would only multiply allocation.
      if (error instanceof UpstreamResponseTooLargeError) break;
      if (attempt < upstreamMaxAttempts) await Bun.sleep(1_000 * attempt);
    }
  }

  throw lastError;
}

export function getRequestVerificationToken(html: string): string {
  const token = parse(html).querySelector('input[name="__RequestVerificationToken"]')?.getAttribute("value");
  if (!token) throw new Error("Request verification token not found");
  return token;
}

export function getFormAction(html: string): string {
  return parse(html).querySelector("form")?.getAttribute("action") ?? "/MCIT/MCIT/PetroleumPrices";
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
