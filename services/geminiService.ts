import { GoogleGenAI, Type } from "@google/genai";
import { IdentifiedItem, IdentifiedItemType } from '../types';

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
};

const pageAnalysisResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: baseItemProperties,
    required: ['type', 'altText', 'keywords', 'taxonomy', 'confidence', 'boundingBox'],
  },
};

const singleImageAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
      ...(({ boundingBox, ...rest }) => rest)(baseItemProperties),
    },
    required: ['type', 'altText', 'keywords', 'taxonomy', 'confidence'],
};

const commonPromptInstructions = `
Key rules for the response:
1.  Perform OCR meticulously if the image contains any text.
2.  For 'altText', describe the content directly without lead-ins like "Image of". For text-heavy images (e.g., 'Scanned Document'), the altText MUST include the full transcribed text.
3.  For 'type', be specific. Use 'Photograph' for real-world photos, 'Illustration' for drawings/cartoons, 'Diagram' for technical drawings, 'Chart/Graph' for data visualizations.
4.  For 'Equation' types, provide a descriptive 'altText' (e.g., "The quadratic formula for solving second-degree polynomial equations").
5.  You MUST provide a pixel-based 'boundingBox' for every element identified on a larger page.
6.  Provide a 'confidence' score between 0.0 and 1.0.
7.  Respond ONLY with the JSON object/array matching the schema. Do not include markdown formatting like \`\`\`json.`;


export const generatePageAnalysis = async (imageBase64: string): Promise<IdentifiedItem[]> => {
  const prompt = `Analyze this document page. Identify ALL significant visual elements: photographs, illustrations, diagrams, tables (raster or native), charts, graphs, equations (MathML or image), maps, comics, and sections of scanned text. For each element, generate a comprehensive analysis.
${commonPromptInstructions}
If no distinct elements are found, treat the entire page as a single 'Scanned Document' element. If the page is truly blank, return an empty array.`;

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
        return parsedJson.filter(item => item && item.type && item.altText && item.boundingBox) as IdentifiedItem[];
    } else {
        throw new Error("The AI model returned data in an unexpected format.");
    }
  } catch (error: any) {
    console.error("Error calling Gemini API for page analysis:", error);
    if (error.message.includes('SAFETY')) {
        throw new Error("Analysis failed: The content was blocked by the safety filter. Please try with a different file.");
    }
    throw new Error(`Failed to generate page analysis. API Error: ${error.message}`);
  }
};


export const generateImageAnalysis = async (imageBase64: string, context?: string): Promise<IdentifiedItem> => {
    let prompt = `Generate a comprehensive analysis for this visual element.
${commonPromptInstructions}`;
    if (context) prompt += `\n\nUse this context from the document: "${context}"`;

    const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
    const data = imageBase64.split(',')[1];
    const imagePart = { inlineData: { mimeType, data } };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: singleImageAnalysisSchema,
                temperature: 0.1,
            },
        });

        const jsonString = (response.text || '').trim();
        if (!jsonString) throw new Error("The AI model returned an empty response.");

        const parsedJson = JSON.parse(jsonString);
        if (parsedJson && parsedJson.type && parsedJson.altText) {
            return parsedJson as IdentifiedItem;
        } else {
            throw new Error("The AI model returned data in an unexpected format.");
        }
    } catch (error: any) {
        console.error("Error calling Gemini API for single image:", error);
        if (error.message.includes('SAFETY')) {
            throw new Error("Analysis failed: The image was blocked by the safety filter.");
        }
        throw new Error(`Failed to generate image analysis. API Error: ${error.message}`);
    }
};

export const generateSummary = async (identifiedItems: IdentifiedItem[]): Promise<string> => {
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
        return response.text || '';
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