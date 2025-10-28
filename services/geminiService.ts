import { GoogleGenAI, Type } from "@google/genai";
import { IdentifiedItem } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const baseItemProperties = {
  type: {
    type: Type.STRING,
    description: "The type of the element. Must be one of 'Image', 'Table', 'Equation', 'Map', 'Comics', or 'Other'.",
  },
  altText: {
    type: Type.STRING,
    description: 'A concise and descriptive alternative text for the element.',
  },
  keywords: {
    type: Type.STRING,
    description: 'A comma-separated list of 3-5 relevant keywords for the element.'
  },
  taxonomy: {
    type: Type.STRING,
    description: 'A hierarchical category for the element, using ">" as a separator (e.g., "Science > Physics > Optics").'
  }
};

const pageAnalysisResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: baseItemProperties,
    required: ['type', 'altText', 'keywords', 'taxonomy'],
  },
};

const singleImageAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        ...baseItemProperties,
    },
    required: ['type', 'altText', 'keywords', 'taxonomy'],
};

const commonPromptInstructions = `
Key rules for the response:
1. For 'altText', do NOT use generic lead-ins like "Image of" or "Figure showing". Describe the content directly.
2. For mathematical/scientific notation, use standard Unicode characters where possible (e.g., "x²", "α", "∑"). Describe the overall purpose of complex equations.
3. For 'keywords', provide a comma-separated list.
4. For 'taxonomy', provide a hierarchical string using '>'.
5. Respond ONLY with the JSON object/array matching the schema.`;


export const generatePageAnalysis = async (imageBase64: string): Promise<IdentifiedItem[]> => {
  const prompt = `Analyze this document page. Identify all significant visual elements: images, tables, equations, maps, comics, and other diagrams. For each element, generate a comprehensive analysis including alt text, keywords, and taxonomy.
${commonPromptInstructions}
If no elements are found, return an empty array.`;

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.split(',')[1],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: pageAnalysisResponseSchema,
        temperature: 0.2,
      },
    });

    const jsonString = response.text.trim();
    if (!jsonString) return [];
    
    let parsedJson;
    try {
        parsedJson = JSON.parse(jsonString);
    } catch (parseError) {
        console.error("Gemini API returned non-JSON response:", jsonString);
        throw new Error("The AI model returned an invalid response. Please try again.");
    }
    
    if (Array.isArray(parsedJson)) {
        return parsedJson.filter(item => item && item.type && item.altText) as IdentifiedItem[];
    } else {
        console.error("Gemini API response is not an array as expected:", parsedJson);
        throw new Error("The AI model returned data in an unexpected format.");
    }
  } catch (error) {
    console.error("Error calling Gemini API for page analysis:", error);
    if (error instanceof Error && (error.message.includes("invalid response") || error.message.includes("unexpected format"))) {
        throw error;
    }
    throw new Error("Failed to generate analysis. The Gemini API call failed. Check your API key and network connection.");
  }
};

/**
 * Converts an image from a base64 string to a supported MIME type (PNG) if necessary.
 * @param imageBase64 The input image as a base64 data URL.
 * @returns A promise that resolves to a base64 data URL with a supported MIME type.
 */
const convertToSupportedMimeType = async (imageBase64: string): Promise<string> => {
    const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
    // List of MIME types supported by Gemini Pro Vision
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

    if (supportedMimeTypes.includes(mimeType)) {
        return imageBase64; // No conversion needed
    }

    // If not supported, convert to PNG
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context for image conversion.'));
            }
            ctx.drawImage(img, 0, 0);
            // Convert to PNG, which is widely supported.
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => {
            console.error("Image conversion failed:", err);
            reject(new Error(`Failed to load image with unsupported MIME type (${mimeType}) for conversion.`));
        };
        img.src = imageBase64;
    });
};


export const generateImageAnalysis = async (imageBase64: string, context?: string): Promise<IdentifiedItem> => {
    let prompt = `Generate a comprehensive analysis for this visual element, intended for a visually impaired user and for asset management. Provide its type, alt text, keywords, and taxonomy.`;

    if (context) {
        prompt += `\n\nUse the following text from the document for context when generating the analysis:\n---\n${context}\n---`;
    }
    
    prompt += `\n${commonPromptInstructions}`;


    try {
        const supportedImageBase64 = await convertToSupportedMimeType(imageBase64);
        
        const mimeType = supportedImageBase64.substring(supportedImageBase64.indexOf(':') + 1, supportedImageBase64.indexOf(';'));
        const data = supportedImageBase64.split(',')[1];

        const imagePart = { inlineData: { mimeType, data } };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: singleImageAnalysisSchema,
                temperature: 0.2,
            },
        });

        const jsonString = response.text.trim();
        if (!jsonString) {
            throw new Error("The AI model returned an empty response.");
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Gemini API returned non-JSON response:", jsonString);
            throw new Error("The AI model returned an invalid response. Please try again.");
        }

        if (parsedJson && parsedJson.type && parsedJson.altText) {
            return parsedJson as IdentifiedItem;
        } else {
            console.error("Invalid response structure from Gemini API:", parsedJson);
            throw new Error("The AI model returned data in an unexpected format.");
        }
    } catch (error) {
        console.error("Error calling Gemini API for a single image:", error);
        if (error instanceof Error && (error.message.includes("invalid response") || error.message.includes("unexpected format") || error.message.includes("empty response") || error.message.includes("conversion"))) {
            throw error;
        }
        throw new Error("Failed to generate analysis for the image. The Gemini API call may have failed.");
    }
};