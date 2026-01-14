import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not defined" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const { message, media, history } = await req.json();

    // Prepare parts for the current message
    const promptParts: any[] = [];

    // Check if media is present (image or video)
    if (media && media.data) {
      promptParts.push({
        inlineData: {
          data: media.data, // Expecting base64 string
          mimeType: media.mimeType,
        },
      });
    }

    if (message) {
      promptParts.push({ text: message });
    }

    // Convert client history to Gemini format (text only for context to keep payload small)
    // Note: In a production app, you might want to store session on server or handle full history better.
    const chatHistory = history?.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })) || [];

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(promptParts);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
