import { GoogleGenAI, Type } from "@google/genai";
import { IdentifiedItem, IdentifiedItemType, ProcessedItem } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const baseItemProperties = {
  type: {
    type: Type.STRING,
    description: "The type of the element. Must be one of: 'Photograph', 'Illustration', 'Diagram', 'Table', 'Chart/Graph', 'Equation', 'Map', 'Comic', 'Scanned Document', or 'Other'.",
  },
  altText: {
    type: Type.STRING,
    description: 'A concise, detailed, and descriptive alternative text for the element. If the image contains text (like a scanned document), include the full transcribed text. For equations, provide a semantic description.',
  },
  keywords: {
    type: Type.STRING,
    description: 'A comma-separated list of 3-5 relevant keywords for the element.'
  },
  taxonomy: {
    type: Type.STRING,
    description: 'A hierarchical category for the element, using ">" as a separator (e.g., "Science > Physics > Optics").'
  },
  confidence: {
    type: Type.NUMBER,
    description: 'A confidence score from 0.0 to 1.0 for the overall accuracy of the analysis.'
  },
};

const pageAnalysisResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      ...baseItemProperties,
      boundingBox: {
        type: Type.OBJECT,
        description: 'The bounding box of the identified element in pixels, relative to the top-left of the image. This is required for all elements.',
        properties: {
            x: { type: Type.NUMBER, description: 'The x-coordinate of the top-left corner.' },
            y: { type: Type.NUMBER, description: 'The y-coordinate of the top-left corner.' },
            width: { type: Type.NUMBER, description: 'The width of the element.' },
            height: { type: Type.NUMBER, description: 'The height of the element.' }
        },
        required: ['x', 'y', 'width', 'height'],
      }
    },
    required: ['type', 'altText', 'keywords', 'taxonomy', 'confidence', 'boundingBox'],
  },
};

const snippetAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: baseItemProperties,
    required: ['type', 'altText', 'keywords', 'taxonomy', 'confidence'],
};

export const generatePageAnalysis = async (imageBase64: string, context?: string): Promise<IdentifiedItem[]> => {
  const prompt = `You are an expert document analysis AI. Your task is to meticulously analyze the provided image of a document page and identify ALL significant visual assets.

**DEFINITIONS:**
- **Asset:** A visual element like a photograph, chart, table, or diagram.
- **Caption:** Text on the page that describes the asset, typically located below or next to it.

**CRITICAL INSTRUCTIONS:**
1.  **Isolate the Asset:** Your primary goal is to separate the visual asset from its surrounding text.
2.  **Analyze the Asset:** For EACH asset you identify, you must:
    a. **Generate contextual alt text that describes the visual content of the asset itself.** Do NOT simply copy text from the caption. You may use the caption for context to understand the asset, but the alt text must describe the visual information presented in the image, chart, or table.
    b. **Provide a 'boundingBox' that tightly encloses ONLY the visual asset.** This box MUST NOT include the asset's caption, title, or any other surrounding text. It should be a precise, tight crop.
3.  **Strict Correlation:** The 'altText' must describe what is inside the 'boundingBox', and the 'boundingBox' must only contain what is described in the 'altText'.
4.  **No Text Pages:** If the page contains no discernible visual assets (e.g., it is only a page of text), you MUST return an empty array [].
5.  Provide a 'confidence' score between 0.0 and 1.0 for each item.
6.  Respond ONLY with the JSON array matching the schema. Do not include markdown formatting.
${context ? `\n\nAdditional context for this document: "${context}"` : ''}`;

  const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: pageAnalysisResponseSchema,
        temperature: 0.1,
      },
    });

    const jsonString = (response.text || '').trim();
    if (!jsonString) return [];
    
    const parsedJson = JSON.parse(jsonString);
    if (Array.isArray(parsedJson)) {
        return parsedJson.filter(item => item && item.type && item.altText && item.boundingBox && typeof item.confidence === 'number') as IdentifiedItem[];
    } else {
        console.warn("AI returned non-array data for page analysis:", parsedJson);
        return [];
    }
  } catch (error: any) {
    console.error("Error calling Gemini API for page analysis:", error);
    if (error.message.includes('SAFETY')) {
        throw new Error("Analysis failed: The content was blocked by the safety filter. Please try with a different file.");
    }
    throw new Error(`Failed to generate page analysis. API Error: ${error.message}`);
  }
};


export const generateSnippetAnalysis = async (imageBase64: string, assetTypeHint: 'Image' | 'Table' | 'Equation'): Promise<IdentifiedItem | null> => {
    const prompt = `You are an expert document analysis AI. Your primary task is to identify and describe the visual asset in the provided image snippet.

**CRITICAL INSTRUCTIONS:**
1.  **Identify First:** Determine the most accurate type for this asset. Your choices are: 'Photograph', 'Illustration', 'Diagram', 'Table', 'Chart/Graph', 'Equation', 'Map', 'Comic', or 'Other'. The system that extracted this snippet provides a hint that it might be a '${assetTypeHint}', but you MUST rely on your own visual analysis to make the final, most accurate classification.
2.  **Describe Second:** Generate detailed, contextual alt text and all other metadata fields for this asset.
3.  **Tailor your 'altText' to the asset type:**
    - For a **Table**: Describe its structure (rows, columns), its purpose, and summarize its key data.
    - For an **Equation**: Provide a clear semantic description of the mathematical expression.
    - For a **Chart/Graph**: Describe the type of chart (e.g., bar, line, pie), the data it represents, and its main takeaway.
    - For a **Photograph/Illustration/Diagram**: Describe the scene, subjects, actions, and important details.
4.  Provide a 'confidence' score between 0.0 and 1.0 reflecting your certainty in the analysis.
5.  Since this is a pre-cropped snippet, you MUST NOT provide a 'boundingBox'.
6.  Respond ONLY with the JSON object matching the schema. Do not include markdown formatting.`;

    const imagePart = { inlineData: { mimeType: 'image/png', data: imageBase64.split(',')[1] } };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: snippetAnalysisResponseSchema,
                temperature: 0.1,
            },
        });
        const jsonString = (response.text || '').trim();
        if (!jsonString) return null;
        const parsedJson = JSON.parse(jsonString);
        return (parsedJson && parsedJson.type && parsedJson.altText) ? parsedJson as IdentifiedItem : null;
    } catch (error: any) {
        console.error(`Error calling Gemini API for ${assetTypeHint} snippet analysis:`, error);
        if (error.message.includes('SAFETY')) {
            throw new Error(`Analysis failed for ${assetTypeHint} snippet: The content was blocked by the safety filter.`);
        }
        throw new Error(`Failed to generate snippet analysis. API Error: ${error.message}`);
    }
};


export const generateSummary = async (identifiedItems: ProcessedItem[]): Promise<string> => {
    if (identifiedItems.length === 0) return "No visual elements were identified in the document.";
    
    const itemCounts = identifiedItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
    }, {} as Record<IdentifiedItemType, number>);

    const summaryList = Object.entries(itemCounts)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ');

    const prompt = `Based on the following list of identified visual assets from a document, write a brief, one-paragraph summary of the document's visual content.
    
    Assets found: ${summaryList}.
    
    Example: "The document appears to be a technical report, containing 3 Tables, 2 Charts/Graphs, and 1 Diagram to visualize data and concepts."`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return (response.text || '').trim();
    } catch (error) {
        console.error("Error generating summary:", error);
        return `The document contains the following assets: ${summaryList}.`; // Fallback summary
    }
}


export const explainError = async (errorMessage: string): Promise<string> => {
    const prompt = `An error occurred in a web application. Explain this error to a non-technical user in a clear, friendly, and simple way. Provide a likely cause and one or two actionable suggestions. Keep the explanation to 1-2 sentences.

    Error Message: "${errorMessage}"

    Example format:
    Explanation: [Friendly explanation].
    Suggestion: [Actionable suggestion].
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return (response.text || errorMessage).replace("Explanation: ", "").replace("Suggestion: ", "\nSuggestion: ");
    } catch (error) {
        console.error("Error explaining error:", error);
        return errorMessage; // Fallback to original error message
    }
};