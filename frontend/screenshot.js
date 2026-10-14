const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const baseURL = "http://localhost:5173";
  const screenshotDir = "./screenshots";

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  async function shot(name) {
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: `${screenshotDir}/${name}.png`,
      fullPage: true
    });
    console.log(`✓ ${name}`);
  }

  console.log("Starting SmartEvent screenshot capture...");

  // HOME
  await page.goto(baseURL);
  await shot("01-home");

  // EVENTS
  const eventsButton = page.locator("button").filter({ hasText: "Events" }).first();
  if (await eventsButton.count()) {
    await eventsButton.click();
    await shot("02-events");
  }

  // DASHBOARD
  await page.goto(baseURL);
  await page.waitForTimeout(1000);

  const dashboardButton = page.locator("button").filter({ hasText: "Dashboard" }).first();

  if (await dashboardButton.count()) {
    await dashboardButton.click();
    await shot("03-dashboard");
  } else {
    console.log("⚠ Dashboard button not available");
  }

  // MY BOOKINGS
  await page.goto(baseURL);
  await page.waitForTimeout(1000);

  const bookingsButton = page.locator("button").filter({ hasText: "My Bookings" }).first();

  if (await bookingsButton.count()) {
    await bookingsButton.click();
    await shot("04-my-bookings");
  } else {
    console.log("⚠ My Bookings button not available");
  }

  // NOTIFICATIONS
  await page.goto(baseURL);
  await page.waitForTimeout(1000);

  const notificationsButton = page.locator("button").filter({ hasText: "Notifications" }).first();

  if (await notificationsButton.count()) {
    await notificationsButton.click();
    await shot("05-notifications");
  } else {
    console.log("⚠ Notifications button not available");
  }

  // MOBILE HOME
  await page.setViewportSize({
    width: 390,
    height: 844
  });

  await page.goto(baseURL);
  await shot("06-mobile");

  console.log("");
  console.log("======================================");
  console.log("SCREENSHOT CAPTURE COMPLETED");
  console.log("======================================");

  await browser.close();
})();