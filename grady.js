const fs = require("fs");
const playwright = require("playwright");
const { getRandom } = require("random-useragent");
const jsonToCsv = require("json-2-csv");

const scrapeData = async (url) => {
  const browser = await playwright.chromium.launch({
    headless: true,
  });
  console.log("Browser launched");

  const context = await browser.newContext({
    userAgent: getRandom(),
  });
  console.log("New context created");

  const page = await context.newPage();
  console.log("New page created");

  try {
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log(`Page loaded: ${url}`);

    const links = await page.$$eval(".hide-for-small-only a", (elements) => {
      return elements.map((link) => {
        return (
          "https://tcsi-roster.azurewebsites.net/" + link.getAttribute("href")
        );
      });
    });
    console.log(`Found ${links.length} links to scrape`);

    const promises = links.map(async (link) => {
      try {
        console.log(`Scraping data from ${link}`);
        const newContext = await browser.newContext({
          userAgent: getRandom(),
        });
        const newPage = await newContext.newPage();
        await newPage.goto(link, { waitUntil: "domcontentloaded" });
        console.log(`Data page loaded: ${link}`);

        const [
          name,
          booking,
          bookingDate,
          primaryoffence,
          arrestingAgency,
          scheduleReleaseDate,
          age,
          sex,
          height,
          weight,
          race,
          hair,
          eyes,
          glasses,
        ] = await newPage.$$eval(".postfix", (elements) => {
          return elements.map((content) => content.textContent.trim());
        });

        await newContext.close();
        console.log(`Data scraped successfully from ${link}`);

        return {
          name,
          booking,
          bookingDate,
          primaryoffence,
          arrestingAgency,
          scheduleReleaseDate,
          age,
          sex,
          height,
          weight,
          race,
          hair,
          eyes,
          glasses,
        };
      } catch (err) {
        console.error(`Error scraping ${link}:`, err);
        return null;
      }
    });

    const results = await Promise.all(promises.filter((p) => p !== null));

    const csvData = jsonToCsv.json2csv(results);
    fs.writeFileSync(`grady.csv`, csvData);
    console.log("Data is written successfully");

    console.log("Scraping completed");
    console.log(results);
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
};

scrapeData(
  "https://tcsi-roster.azurewebsites.net/default.aspx?code=grady&type=roster&i=44"
);
