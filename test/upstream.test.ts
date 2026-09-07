import { describe, expect, test } from "bun:test";
import { getFormAction, getRequestVerificationToken, textWithLimit } from "../src/backend/upstream";

const formHtml = `<!doctype html>
<html><body>
<form action="/MCIT/MCIT/PetroleumPrices?fuel=1&amp;x=1" method="post">
  <input type="hidden" name="__RequestVerificationToken" value="abc&amp;def123">
</form>
</body></html>`;

describe("upstream form extraction", () => {
  test("extracts the request verification token and decodes entities", () => {
    expect(getRequestVerificationToken(formHtml)).toBe("abc&def123");
  });

  test("extracts the form action", () => {
    expect(getFormAction(formHtml)).toBe("/MCIT/MCIT/PetroleumPrices?fuel=1&x=1");
  });

  test("throws when the token is missing", () => {
    expect(() => getRequestVerificationToken("<html></html>")).toThrow("Request verification token not found");
  });

  test("falls back to the default action when no form exists", () => {
    expect(getFormAction("<html></html>")).toBe("/MCIT/MCIT/PetroleumPrices");
  });
});

describe("textWithLimit", () => {
  test("aborts a chunked body that exceeds the cap while streaming (no content-length)", async () => {
    const chunk = new Uint8Array(512 * 1024);
    const body = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 40; i++) {
          controller.enqueue(chunk);
          await Bun.sleep(1);
        }
        controller.close();
      },
    });
    const response = new Response(body, { status: 200 });
    const caught = await textWithLimit(response, "GET").then(
      () => null,
      (cause: unknown) => cause, // eslint-style catch-all: the body is hostile, shape unknown
    );
    expect(caught).not.toBeNull();
    expect(String(caught)).toContain("exceeds");
  });

  test("short-circuits on an oversized content-length header", async () => {
    const response = new Response("tiny", { status: 200, headers: { "content-length": "999999999" } });
    const caught = await textWithLimit(response, "GET").then(
      () => null,
      (cause: unknown) => cause, // eslint-style catch-all: the body is hostile, shape unknown
    );
    expect(String(caught)).toContain("too large");
  });

  test("leaves a body under the cap intact", async () => {
    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode("hello"));
        controller.close();
      },
    });
    const response = new Response(body, { status: 200 });
    expect(await textWithLimit(response, "GET")).toBe("hello");
  });
});
