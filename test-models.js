const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function main() {
    try {
        const envPath = path.join(process.cwd(), ".env.local");
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/GOOGLE_API_KEY=(.*)/);

        if (!match || !match[1]) {
            console.error("Could not find GOOGLE_API_KEY in .env.local");
            return;
        }

        const apiKey = match[1].trim();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just getting the object to access the client, actually better to use the client directly if possible, but SDK exposes listModels on the class instance? No, it's typically on the client or I might need to make a REST call if the SDK doesn't expose it easily in this version.

        // Actually, in @google/generative-ai, verified way to list models:
        // There isn't a direct helper on the top level class in some versions, but let's check via a generated request or just try to fetch a known working one.

        // Alternative: Just try to generate content with 'gemini-pro' to see if it works.
        console.log("Testing gemini-pro...");
        const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await modelPro.generateContent("Hello");
        console.log("gemini-pro response:", await result.response.text());

        console.log("Testing gemini-1.5-flash...");
        const modelFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const resultFlash = await modelFlash.generateContent("Hello");
        console.log("gemini-1.5-flash response:", await resultFlash.response.text());

    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();
