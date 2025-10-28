
// This assumes pdf.js is loaded via a script tag in index.html
declare const pdfjsLib: any;

/**
 * Processes a PDF file and converts each page into a base64 encoded JPEG image.
 * @param file The PDF file to process.
 * @returns A promise that resolves to an array of base64 image strings.
 */
export const processPdfToImages = async (file: File): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const numPages = pdf.numPages;
    const pageImages: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      // Use a higher scale for better image quality to send to Gemini
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
          throw new Error('Could not get canvas context');
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      // Use JPEG for smaller file size
      pageImages.push(canvas.toDataURL('image/jpeg', 0.9));
    }

    return pageImages;
  } catch (error) {
    console.error("Error processing PDF file:", error);
    throw new Error("Failed to process PDF. The file may be corrupt or an unsupported version.");
  }
};
