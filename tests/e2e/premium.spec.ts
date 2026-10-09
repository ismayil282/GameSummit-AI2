import { test, expect } from "@playwright/test";
test("demo premium enables a voice upload and illustrated PDF export", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Preview Premium", exact: true }).click();
  await expect(page.locator(".plan-summary")).toContainText("Family Premium");
  await page.getByRole("link", { name: "Canvas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Our family canvas" })).toBeVisible();
  // A valid one-second mono WAV recording, created in memory.
  const wav = Buffer.alloc(16044); wav.write("RIFF",0); wav.writeUInt32LE(16036,4); wav.write("WAVE",8); wav.write("fmt ",12); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write("data",36); wav.writeUInt32LE(16000,40);
  await page.locator('.app-shell:visible input[type="file"][accept="audio/*"]').setInputFiles({ name: "message.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.locator(".app-shell:visible .memory-card.voice")).toHaveCount(2);
  await page.getByRole("button", { name: "Create a storybook", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await pdf.saveAs("test-results/demo-storybook.pdf");
  await page.screenshot({ path: "test-results/storybook.png", fullPage: true });
});
