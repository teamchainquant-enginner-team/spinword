import { expect, test } from "@playwright/test";

test("claims Loot Coins and locks settings after starting a round", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Pick your risk/ })).toBeVisible();
  const claim = page.getByRole("button", { name: "Claim free Loot Coins" });
  if (await claim.isVisible()) await claim.click();
  await page.getByRole("button", { name: /Max Mode/ }).click();
  await page.getByLabel("Play amount").fill("1");
  await page.getByRole("button", { name: "Review & confirm round" }).click();
  await page.getByRole("button", { name: "Confirm & start round" }).click();
  await expect(page.getByText(/is active/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Standard Mode/ })).toBeDisabled();
  const activeResponse = await page.request.get("/api/rounds?active=true");
  const { activeRound } = await activeResponse.json();
  for (let guess = 0; guess < 6; guess += 1) {
    const response = await page.request.post(`/api/rounds/${activeRound.id}/guesses`, { data: { guess: "CRANE" } });
    const settled = await response.json();
    if (settled.status === "SETTLED") break;
  }
});
