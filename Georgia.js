const fs = require("fs");
const playwright = require("playwright");
const { getRandom } = require("random-useragent");
const jsonToCsv = require("json-2-csv");

const scrapeData = async (url, pages, name) => {
  const browser = await playwright.chromium.launch({
    headless: true,
  });

  const maxRetries = 3; // Maximum number of retries for each page
  let retryAttempts = 0;

  try {
    const promised = [];

    for (let i = 1; i <= pages; i++) {
      const context = await browser.newContext({
        userAgent: getRandom(),
      });
      const page = await context.newPage();

      let success = false;
      while (!success && retryAttempts < maxRetries) {
        try {
          await page.goto(`${url}${i}`, { timeout: 30000 });
          console.log(`Opened page ${i}`);
          success = true;
        } catch (error) {
          if (error.name === "TimeoutError") {
            console.error(`Timeout navigating to page ${i}:`, error);
          } else {
            console.error(`Error navigating to page ${i}:`, error);
          }
          retryAttempts++;
          if (retryAttempts >= maxRetries) {
            throw new Error(`Max retries exceeded for page ${i}`);
          }
          // Wait for a short while before retrying
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      if (!success) {
        continue; // Skip to the next page if unable to load after retries
      }

      const data = await page.$$eval(".thumbnail56 a", (links) =>
        links.map((link) => link.getAttribute("href"))
      );

      // Process each link concurrently
      const pagePromises = data.map(async (link) => {
        const newContext = await browser.newContext({
          userAgent: getRandom(),
        });
        const newPage = await newContext.newPage();

        success = false;
        retryAttempts = 0;
        while (!success && retryAttempts < maxRetries) {
          try {
            await newPage.goto(link, { timeout: 30000 });
            console.log(`Opened the new url: ${link} from page ${i}`);
            success = true;
          } catch (error) {
            if (error.name === "TimeoutError") {
              console.error(
                `Timeout navigating to ${link} from page ${i}:`,
                error
              );
            } else {
              console.error(
                `Error navigating to ${link} from page ${i}:`,
                error
              );
            }
            retryAttempts++;
            if (retryAttempts >= maxRetries) {
              throw new Error(
                `Max retries exceeded for ${link} from page ${i}`
              );
            }
            // Wait for a short while before retrying
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }

        if (!success) {
          await newContext.close(); // Close context if unsuccessful
          return null;
        }

        const [name, date, reason] = await newPage.$$eval(
          ".has-text-align-center",
          (data) => data.map((node) => node.textContent.split(":")[1])
        );

        const [image] = await newPage.$$eval(
          ".single_thumbnail56 thumbnail56--standard post-thumbnail img",
          (all) => {
            return all.map((link) => link.getAttribute("src"));
          }
        );

        await newContext.close();
        return { name, date, reason, image };
      });

      promised.push(...pagePromises);

      await context.close();
    }

    const results = await Promise.all(promised);
    console.log(results.filter((result) => result !== null)); // Filter out null results

    const filteredResults = results.filter((result) => result !== null); // Filter out null results
    const csvData = jsonToCsv.json2csv(filteredResults);
    fs.writeFileSync(`${name}.csv`, csvData);
    console.log("Data is written successfully");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
};

scrapeData("https://thegeorgiagazette.com/charlton/page/", 234, "charlton");
