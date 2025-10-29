// This assumes mammoth.js and html2canvas.js are loaded via script tags in index.html
declare const mammoth: any;
declare const html2canvas: any;

/**
 * Renders HTML content into a series of paged images using the html2canvas library.
 * This is a robust method to get a high-fidelity visual representation of the document.
 * @param html The HTML content of the document's body.
 * @param documentStyles The CSS styles extracted from the document.
 * @returns A promise that resolves to an array of base64 encoded PNG images.
 */
const renderHtmlViaCanvas = (html: string, documentStyles: string): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
        const PAGE_WIDTH = 794; // A4-like width
        const PAGE_HEIGHT = 1123; // A4-like height
        const RENDER_SCALE = 2; // Render at 2x resolution for clarity

        // 1. Create a hidden container and append it to the DOM
        // html2canvas needs the element to be in the DOM to compute styles
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px'; // Position off-screen
        container.style.width = `${PAGE_WIDTH}px`;
        container.style.backgroundColor = 'white';
        container.style.color = 'black';
        
        // Inject styles directly to ensure they are applied
        const style = `
            <style>
                body { margin: 0; font-family: sans-serif; }
                ${documentStyles}
                img { max-width: 100% !important; height: auto !important; }
                table { border-collapse: collapse !important; width: 100% !important; page-break-inside: avoid; }
                p, h1, h2, h3, h4, h5, h6, li, blockquote { page-break-inside: avoid; }
            </style>`;
            
        container.innerHTML = style + html;
        document.body.appendChild(container);

        try {
            // 2. Use html2canvas to "screenshot" the entire container
            const mainCanvas = await html2canvas(container, {
                scale: RENDER_SCALE,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: true,
            });

            // 3. Paginate the resulting tall canvas into individual page images
            const totalHeight = mainCanvas.height;
            const numPages = Math.ceil(totalHeight / (PAGE_HEIGHT * RENDER_SCALE));
            const pageImages: string[] = [];
            
            if(totalHeight === 0) {
                resolve([]);
                return;
            }

            for (let i = 0; i < numPages; i++) {
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = mainCanvas.width;
                pageCanvas.height = PAGE_HEIGHT * RENDER_SCALE;
                const ctx = pageCanvas.getContext('2d');
                if (!ctx) continue;
                
                // Fill with white background in case of empty space at the end
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                
                const sx = 0;
                const sy = i * PAGE_HEIGHT * RENDER_SCALE;
                const sWidth = mainCanvas.width;
                // Clamp the height to not read past the end of the source canvas
                const sHeight = Math.min(PAGE_HEIGHT * RENDER_SCALE, totalHeight - sy);

                if (sHeight > 0) {
                    ctx.drawImage(mainCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
                }

                pageImages.push(pageCanvas.toDataURL('image/png', 0.92));
            }
            resolve(pageImages);

        } catch (error) {
            console.error("html2canvas rendering failed:", error);
            reject(new Error("Failed to render document content to an image."));
        } finally {
            // 4. Clean up by removing the hidden container from the DOM
            document.body.removeChild(container);
        }
    });
};


/**
 * Processes a DOCX file by converting it into a series of page-like images.
 * This provides a high-fidelity visual representation for the AI to analyze,
 * mirroring the robust process used for PDFs.
 * @param file The DOCX file.
 * @returns A promise that resolves to an array of base64 encoded page images.
 */
export const processDocxToImages = async (file: File): Promise<string[]> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        const html = result.value;
        if (!html || html.trim() === '') {
            return []; // Document is empty
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const styleBlocks = Array.from(doc.head.querySelectorAll('style'));
        const documentStyles = styleBlocks.map(style => style.innerHTML).join('\n');
        
        return await renderHtmlViaCanvas(doc.body.innerHTML, documentStyles);
        
    } catch (error) {
        console.error("Error processing DOCX file:", error);
        throw new Error("Failed to process DOCX. The file may be corrupt, password-protected, or in an unsupported format.");
    }
};
