const fs = require("fs");
const playwright = require("playwright");
const { userAgent } = require("random-useragent");
const jsonToCsv = require("json-2-csv")

const scrapeData = async (url, name, pages) => {
    const browser = await playwright.chromium.launch({
        headless: true,
    });
    const results = [];
    const context = await browser.newContext({
        userAgent: userAgent,
    });
    const page = await context.newPage();
    try {
        for (let number = 1; number <= pages; number++) {
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
                    // Handling cases where values may include privacy policy or copyright text
                    const sanitizeValue = (value) => {
                        return value?.includes("Privacy Policy") || value?.includes("© Copyright 2024") ? "none" : value;
                    };

                    age = sanitizeValue(age);
                    gender = sanitizeValue(gender);
                    race = sanitizeValue(race);
                    hairColor = sanitizeValue(hairColor);
                    eyeColor = sanitizeValue(eyeColor);
                    height = sanitizeValue(height);
                    weight = sanitizeValue(weight);
                    city = sanitizeValue(city);
                    arrestingAgency = sanitizeValue(arrestingAgency);

                    const [image] = await newPage.$$eval(".detail-img", all => all.map(images => images.getAttribute("src")));

                    const charges = await newPage.$$eval(".opening-info ul li", all => {
                        return all.map(text => text.textContent.trim());
                    });
                    const chargesOfInmate = charges.map(charge => {
                        const chargeCode = charge.slice("Charge Code:".length + 1, charge.indexOf("Charge Description:")).trim();
                        const chargeDescription = charge.slice(charge.indexOf("Charge Description:") + "Charge Description:".length, charge.indexOf("Bond")).trim();
                        const bondAmount = charge.split("Bond Amount: ")[1]?.trim() || "none";
                        return {
                            chargeCode,
                            chargeDescription,
                            bondAmount,
                        };
                    });

                    results.push({
                        name: name || "none",
                        bookingNumber: bookingNumber || "none",
                        bookingDate: bookingDate || "none",
                        age,
                        gender,
                        race,
                        height,
                        weight,
                        hairColor,
                        eyeColor,
                        city,
                        arrestingAgency,
                        image: image || "none",
                        charges: chargesOfInmate,
                    });
                    await newPage.close();
                } catch (err) {
                    console.error("Error scraping individual link:", err);
                }
            }
            console.log(`Page ${number} is completed`);
        }
    } catch (err) {
        console.error("Error navigating to page:", err);
    } finally {
        await browser.close();
    }

    const jsonData = results.map((result) => {
        return {
            name: result.name,
            bookingNumber: result.bookingNumber,
            bookingDate: result.bookingDate,
            age: result.age,
            gender: result.gender,
            race: result.race,
            height: result.height,
            weight: result.weight,
            hairColor: result.hairColor,
            eyeColor: result.eyeColor,
            city: result.city,
            arrestingAgency: result.arrestingAgency,
            image: result.image,
            charges: result.charges.map(charge => `Charge Code: ${charge.chargeCode}, Charge Description: ${charge.chargeDescription}, Bond Amount: ${charge.bondAmount}`).join("; "),
        };
    });

    console.log(jsonData); 
    const csvData = jsonToCsv.json2csv(jsonData)
    fs.writeFileSync(`${name}.csv`, csvData);
    console.log("Data is written successfully");
};




const counties = [
    {
        name: "Lake",
        url: "https://recentlybooked.com/FL/Lake",
        pages : 109,
    },
    {
        name: "Hernando",
        url: "https://recentlybooked.com/FL/Hernando",
        pages : 64,
    },
    {
        name: "PalmBeach",
        url : "https://recentlybooked.com/FL/Palm%20Beach",
        pages: 325
    }
]


for (const data of counties) {
    scrapeData(data.url, data.name, data.pages);
}

