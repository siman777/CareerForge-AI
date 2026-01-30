import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";

// New Gemini client
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // Every Sunday at midnight
  async ({ step }) => {

    // Fetch all industries
    const industries = await step.run("Fetch industries", () => {
      return db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
        Analyze the current state of the ${industry} industry and return ONLY JSON:
        {
          "salaryRanges": [
            { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
          ],
          "growthRate": number,
          "demandLevel": "High" | "Medium" | "Low",
          "topSkills": ["skill1", "skill2"],
          "marketOutlook": "Positive" | "Neutral" | "Negative",
          "keyTrends": ["trend1", "trend2"],
          "recommendedSkills": ["skill1", "skill2"]
        }
        DO NOT return markdown. ONLY the raw JSON.
      `;

      // Gemini API call through Inngest AI wrapper
      const response = await step.ai.wrap(
        "gemini",
        async (p) => {
          return await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: p,
          });
        },
        prompt
      );

      // Log the response
      console.log("===== RAW GEMINI RESPONSE =====");
      console.dir(response, { depth: 10 });
      console.log("===== END RAW GEMINI RESPONSE =====");

      // FIXED: Correct extraction based on your actual response
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error("❌ NO TEXT FOUND:", response);
        throw new Error("Gemini returned no text output");
      }

      const cleaned = text.replace(/```json|```/g, "").trim();
      const insights = JSON.parse(cleaned);

      // ⭐ REQUIRED FIX: Prisma ENUM conversion
      insights.demandLevel = insights.demandLevel.toUpperCase();
      insights.marketOutlook = insights.marketOutlook.toUpperCase();

      // Save insights
      await step.run(`Update insights for ${industry}`, () => {
        return db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);
