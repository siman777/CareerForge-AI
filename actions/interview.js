"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

/** NEW GEMINI CLIENT */
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      industry: true,
      skills: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
    Generate 5 technical MCQ interview questions for a ${user.industry} professional
    ${user.skills?.length ? `with skills in: ${user.skills.join(", ")}` : ""}.

    Format response as JSON ONLY:
    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string",
          "explanation": "string"
        }
      ]
    }
    Do NOT include markdown or extra text.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text =
      response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("❌ Gemini returned no text:", response);
      throw new Error("No quiz text returned");
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const quiz = JSON.parse(cleaned);

    return quiz.questions;
  } catch (err) {
    console.error("Error generating quiz:", err);
    throw new Error("Failed to generate quiz questions");
  }
}

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const questionResults = questions.map((q, i) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[i],
    isCorrect: q.correctAnswer === answers[i],
    explanation: q.explanation,
  }));

  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  let improvementTip = null;

  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Q: "${q.question}" | Correct: "${q.answer}" | User: "${q.userAnswer}"`
      )
      .join("\n");

    const improvementPrompt = `
      The user made mistakes in these ${user.industry} interview questions:
      ${wrongQuestionsText}

      Give one short improvement tip (max 2 sentences).
      Do not mention mistakes directly; encourage what to learn next.
    `;

    try {
      const tipResponse = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: improvementPrompt,
      });

      improvementTip =
        tipResponse?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err) {
      console.error("Error generating improvement tip:", err);
    }
  }

  try {
    return await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: "Technical",
        improvementTip,
      },
    });
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.assessment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
}
