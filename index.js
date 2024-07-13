const fs = require("fs");
const playwright = require("playwright");
const { userAgent } = require("random-useragent");
const {convertToCSV} = require("convert-to-csv")

const scrapeData = async (url) => {
    const browser = await playwright.chromium.launch({
        headless: true,
    });
    const results = [];
    const context = await browser.newContext({
        userAgent: userAgent,
    });
    const page = await context.newPage();
    try {
        for (let number = 1; number <= 6; number++) {
            await page.goto(`${url}/Page/${number}`);
            const data = await page.$$eval(".submit-appt", (allLinks) => {
                return allLinks.map(link => link.getAttribute("href")).filter(link => link?.startsWith("/"));
            });
            for (const link of data) {
                console.log("Opening the link: " + link);
                const newPage = await context.newPage();
                try {
                    await newPage.goto(`https://recentlybooked.com${link}`);
                    const [name] = await newPage.$$eval(".info h2", nameElements => {
                        return nameElements.map(element => element.textContent.trim());
                    });
                    const [bookingNumber, bookingDate] = await newPage.$$eval(".col-md-12", all => {
                        return all.map(text => text.textContent.trim().slice(text.textContent.trim().indexOf(":") + 1));
                    });
                    let [age, gender, race, height, weight, hairColor, eyeColor, city, arrestingAgency] = await newPage.$$eval(".col-md-6", all => {
                        return all.map(text => text.textContent.trim().slice(text.textContent.trim().indexOf(":") + 1));
                    });
                    if (height?.includes("© Copyright 2024") || height?.includes("Privacy Policy")) {
                        height = "none"
                    }
                    if (weight?.includes("© Copyright 2024") || weight?.includes("Privacy Policy")) {
                        weight = "none"
                    }

                    if (city?.startsWith("© Copyright 2024") || city?.startsWith(" (City Currently Unavailable)") || city?.includes("Privacy Policy")) {
                        city = "none";
                    }
                    if (arrestingAgency?.startsWith("Privacy Policy") || arrestingAgency?.startsWith("© Copyright 2024.") || arrestingAgency?.includes("Privacy Policy")) {
                        arrestingAgency = "none";
                    }
                    const [image] = await newPage.$$eval(".detail-img", all => all.map(images => images.getAttribute("src")));

                    const charges = await newPage.$$eval(".opening-info ul li", all => {
                        return all.map(text => text.textContent.trim());
                    });
                    const chargesOfInmate = [];
                    for (const charge of charges) {
                        const chargeCode = charge.slice("Charge Code:".length + 1, charge.indexOf("Charge Description:")).trim();
                        const chargeDescription = charge.slice(charge.indexOf("Charge Description:") + "Charge Description:".length, charge.indexOf("Bond")).trim();
                        const bondAmount = charge.split("Bond Amount: ")[1]?.trim();
                        chargesOfInmate.push({
                            chargeCode,
                            chargeDescription,
                            bondAmount: bondAmount || "none",
                        });
                    }
                    results.push({
                        name: name || "none",
                        bookingNumber: bookingNumber || "none",
                        bookingDate: bookingDate || "none",
                        age: age || "none",
                        gender: gender || "none",
                        race: race || "none",
                        height: height || "none",
                        weight: weight || "none",
                        hairColor: hairColor || "none",
                        eyeColor: eyeColor || "none",
                        city: city || "none",
                        arrestingAgency: arrestingAgency || "none",
                        image: image || "none",
                        // charges: chargesOfInmate,
                    });
                    await newPage.close();
                } catch (err) {
                    console.error("Error scraping individual link:", err);
                }
            }
        }
    } catch (err) {
        console.error("Error navigating to page:", err);
    } finally {
        await browser.close();
    }



    console.log(results);
    const writeData = convertToCSV(results);
    fs.writeFileSync("delware.csv", writeData);
    console.log("Data is written successfully");
};

scrapeData('https://recentlybooked.com/NY/Delaware');
