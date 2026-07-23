import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Initialize Gemini API client
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (geminiApiKey) {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully in server.");
  } else {
    console.warn("Warning: GEMINI_API_KEY environment variable is not defined.");
  }

  // Helper to ensure Gemini client is available
  function getGeminiClient(): GoogleGenAI {
    if (!ai) {
      throw new Error("ระบบ AI ยังไม่ได้ทำการตั้งค่าคีย์ API (GEMINI_API_KEY) กรุณาตรวจสอบในแผง Secrets");
    }
    return ai;
  }

  // --- API ROUTE: Create & Edit Images (using gemini-3.1-flash-image-preview) ---
  app.post("/api/gemini/generate-image", async (req, res) => {
    try {
      const client = getGeminiClient();
      const { prompt, base64Image, mimeType, aspectRatio } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: "กรุณาระบุข้อความคำสั่ง (prompt) สำหรับระบุภาพ" });
        return;
      }

      console.log(`Generating/Editing image using gemini-3.1-flash-image-preview. Prompt: "${prompt}"`);

      let response;
      if (base64Image && mimeType) {
        // Image Editing Mode (Prompt + Image)
        // Clean prefix if any
        const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

        response = await client.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType
                }
              },
              {
                text: prompt
              }
            ]
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio || "1:1"
            }
          }
        });
      } else {
        // Text-to-Image Generation Mode
        response = await client.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [
              {
                text: prompt
              }
            ]
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio || "1:1"
            }
          }
        });
      }

      // Extract generated image part
      let outputBase64 = '';
      let textResponse = '';

      if (response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            outputBase64 = part.inlineData.data;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!outputBase64) {
        // Sometimes the model returns a text response or refusal if it violates policies, or is confused
        res.status(500).json({ 
          error: "ไม่สามารถสกัดข้อมูลรูปภาพจากคำสั่งได้", 
          textResponse: textResponse || "โมเดลไม่ได้ส่งรูปภาพกลับมา" 
        });
        return;
      }

      res.json({
        imageUrl: `data:image/png;base64,${outputBase64}`,
        textResponse: textResponse
      });

    } catch (error: any) {
      console.error("Error in generate-image API:", error);
      res.status(500).json({ 
        error: error.message || "เกิดข้อผิดพลาดในการประมวลผลคำสั่งรูปภาพด้วย AI"
      });
    }
  });

  // --- API ROUTE: Search / Maps Grounded Assistant (using gemini-3.5-flash) ---
  app.post("/api/gemini/grounded-assistant", async (req, res) => {
    try {
      const client = getGeminiClient();
      const { prompt, mode, latitude, longitude } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: "กรุณาระบุข้อความสืบค้น (prompt)" });
        return;
      }

      console.log(`Grounded assistant mode: ${mode || 'search'}. Prompt: "${prompt}"`);

      let response;
      if (mode === "maps") {
        // Google Maps Grounding
        const config: any = {
          tools: [{ googleMaps: {} }]
        };

        // Add coordinates in toolConfig if available
        if (latitude && longitude) {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: Number(latitude),
                longitude: Number(longitude)
              }
            }
          };
        }

        response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: config
        });
      } else {
        // Google Search Grounding
        response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
      }

      const text = response.text || "ไม่มีข้อความตอบกลับจากระบบอัจฉริยะ";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      res.json({
        text,
        groundingChunks: chunks
      });

    } catch (error: any) {
      console.error("Error in grounded-assistant API:", error);
      res.status(500).json({ 
        error: error.message || "เกิดข้อผิดพลาดจากบริการค้นหาข้อมูล AI"
      });
    }
  });

  // Serve static assets and bind Vite dev server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving static production assets from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Server] App running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server failure:", err);
});
