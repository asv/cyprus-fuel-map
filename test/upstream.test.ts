import { describe, expect, test } from "bun:test";
import { getFormAction, getRequestVerificationToken } from "../src/backend/upstream";

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
