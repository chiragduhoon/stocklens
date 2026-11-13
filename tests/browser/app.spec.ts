import { test, expect } from "@playwright/test";
test('greetings receive conversational replies without financial citations', async ({page})=>{
  await page.goto('/#assistant');
  await page.getByLabel('Your research question').fill('hi');
  await page.getByRole('button',{name:'Send research question'}).click();
  await expect(page.locator('.answer-prose')).toContainText('Hello!');
  await expect(page.locator('.answer-block')).toContainText('StockLens assistant');
  await expect(page.locator('.answer-block button')).toHaveCount(0);
});
test("Nifty 50 discovery, selection, financial comparison and export", async ({
  page,
}) => {
  await page.goto("/#nifty50");
  await expect(page.getByRole("checkbox")).toHaveCount(50);
  await page.getByLabel("Search Nifty 50 companies").fill("SBIN");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Compare SBIN", exact: true })
    .check();
  await page.getByLabel("Search Nifty 50 companies").fill("");
  await expect(
    page.getByRole("checkbox", { name: "Compare ITC", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Compare 4 companies" }).click();
  await expect(page.locator(".comparison-table thead th")).toHaveCount(5);
  await expect(page.locator(".comparison-context")).toContainText(
    "Different sectors",
  );
  await expect(page.locator(".comparison-table")).toContainText("Net profit");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toContain(
    "financial-comparison",
  );
  await page
    .getByRole("button", { name: "Financial record", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("Financial statement");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Change selection" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
test("overview, stock research, evidence and keyboard dismissal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your portfolio, in perspective." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1M", exact: true }).click();
  await page.getByRole("button", { name: "Analyze INFY", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Company research" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyst research", exact: true })
    .click();
  await expect(
    page.getByText("A consensus is a starting point."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Read evidence record" })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Evidence record" }),
  ).toBeVisible();
  await expect(page.getByText("SIMULATED", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Evidence record" }),
  ).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("add, edit, persist and remove a holding", async ({ page, request }) => {
  const before = (await (await request.get("/api/portfolio")).json()).holdings;
  const target = before.find((h: any) => h.symbol === "ICICIBANK");
  if (target) await request.delete("/api/portfolio/holdings/" + target.id);
  try {
    await page.goto("/#holdings");
    await page
      .getByRole("button", { name: "Add holding", exact: true })
      .click();
    await page.getByLabel("Company", { exact: true }).selectOption("ICICIBANK");
    await page.getByLabel("Number of shares").fill("10");
    await page.getByLabel("Average purchase price (₹)").fill("1100");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add holding", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit ICICIBANK" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Edit ICICIBANK" }).click();
    await expect(page.getByLabel("Number of shares")).toHaveValue("10");
    await page.getByLabel("Number of shares").fill("12");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit ICICIBANK" }).click();
    await page
      .getByRole("button", { name: "Remove holding", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit ICICIBANK" }),
    ).toHaveCount(0);
  } finally {
    const hs = (await (await request.get("/api/portfolio")).json()).holdings;
    const h = hs.find((h: any) => h.symbol === "ICICIBANK");
    if (h) await request.delete("/api/portfolio/holdings/" + h.id);
    if (target)
      await request.post("/api/portfolio/holdings", {
        data: {
          symbol: target.symbol,
          quantity: target.quantity,
          purchase_price: target.purchase_price,
        },
      });
  }
});
test("research filters and global stock search", async ({ page }) => {
  await page.goto("/#research");
  await page.getByRole("button", { name: "Negative", exact: true }).click();
  await page.getByLabel("Filter research by stock").selectOption("INFY");
  await expect(page.locator(".news-row")).toHaveCount(1);
  await expect(page.locator(".news-row")).toContainText(
    "Delayed client approvals",
  );
  await page.getByLabel("Find a company").fill("tata");
  await expect(
    page.locator(".search-results button").filter({ hasText: "TATAMOTORS" }),
  ).toHaveCount(1);
  await page
    .locator(".search-results button")
    .filter({ hasText: "TATAMOTORS" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Tata Motors");
});
test("assistant renders cited and fallback responses honestly", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        answer:
          "Growth is supported by the simulated financial record [F-INFY].",
        source_ids: ["F-INFY"],
        sources: [],
        fallback: false,
        simulated: true,
        insufficient_evidence: false,
        mode: "chat",
        model: "test-model",
      },
    }),
  );
  await page.goto("/#assistant");
  await page.getByLabel("Your research question").fill("Explain INFY growth");
  await page.getByRole("button", { name: "Send research question" }).click();
  await expect(page.locator(".answer-prose")).toContainText(
    "Growth is supported",
  );
  await page.getByRole("button", { name: "F-INFY", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Financial statement");
  await page.keyboard.press("Escape");
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        answer: "Model unavailable.",
        source_ids: [],
        sources: [],
        fallback: true,
        simulated: true,
        insufficient_evidence: true,
        mode: "chat",
      },
    }),
  );
  await page.getByLabel("Your research question").fill("Explain TCS");
  await page.getByRole("button", { name: "Send research question" }).click();
  await expect(
    page.getByText("Prepared response", { exact: false }),
  ).toBeVisible();
});
test("mobile layout has usable navigation and no horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your portfolio, in perspective." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Holdings", exact: true })
    .click();
  await page.getByRole("button", { name: "Add holding", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.getBoundingClientRect().width <= innerWidth),
  ).toBeTruthy();
});
