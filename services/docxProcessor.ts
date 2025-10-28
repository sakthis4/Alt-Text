// This assumes mammoth.js is loaded via a script tag in index.html
declare const mammoth: any;

export interface DocxAsset {
    image: string; // base64
    context: string;
}

/**
 * Renders an HTML element to a base64 encoded image using SVG foreignObject and Canvas.
 */
const renderElementToImage = (element: HTMLElement, width: number, height: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const elementHtml = element.outerHTML;
        const style = `
            <style>
                table { border-collapse: collapse; font-family: sans-serif; font-size: 14px; color: black; background-color: white; margin: 0; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
                th { background-color: #f2f2f2; }
                p, div, span { color: black; }
            </style>`;
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">
                        ${style}
                        ${elementHtml}
                    </div>
                </foreignObject>
            </svg>`;
        const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

        const img = new Image();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not create canvas context'));

        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to render HTML element to image.'));
        img.src = svgUrl;
    });
};

/**
 * Extracts contextual text surrounding a given HTML element by checking its previous and next siblings.
 */
const getContextFromSiblings = (element: HTMLElement): string => {
    const contextParts: string[] = [];
    let prev = element.previousElementSibling;
    if (prev && prev.textContent) {
        contextParts.push(`Previous paragraph: "${prev.textContent.trim()}"`);
    }

    let next = element.nextElementSibling;
    if (next && next.textContent) {
        contextParts.push(`Following paragraph: "${next.textContent.trim()}"`);
    }

    return contextParts.join('\n');
};


/**
 * Extracts visual assets (images, tables) from a .docx file and provides surrounding text as context.
 */
export const processDocxToImages = async (file: File): Promise<DocxAsset[]> => {
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => e.target?.result instanceof ArrayBuffer ? resolve(e.target.result) : reject(new Error('Failed to read file.'));
        reader.onerror = () => reject(reader.error || new Error('File reading error.'));
        reader.readAsArrayBuffer(file);
    });

    try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = '800px'; 
        tempDiv.innerHTML = htmlResult.value;
        document.body.appendChild(tempDiv);
        
        const assets: DocxAsset[] = [];
        // FIX: Add generic type to querySelectorAll to ensure assetElements are of type HTMLElement[], fixing a type error with getContextFromSiblings.
        const assetElements = Array.from(tempDiv.querySelectorAll<HTMLElement>('img, table'));
        const renderPromises: Promise<void>[] = [];

        for (const element of assetElements) {
            // Skip elements that are nested inside another asset (e.g., image in a table)
            if (element.parentElement && assetElements.includes(element.parentElement)) {
                continue;
            }

            const context = getContextFromSiblings(element);
            
            if (element.tagName === 'IMG') {
                const imgElement = element as HTMLImageElement;
                // mammoth.js embeds images as base64 data URIs
                if (imgElement.src.startsWith('data:')) {
                    assets.push({ image: imgElement.src, context });
                }
            } else if (element.tagName === 'TABLE') {
                const tableElement = element as HTMLTableElement;
                const rect = tableElement.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    const promise = renderElementToImage(tableElement, rect.width, rect.height)
                        .then(imageBase64 => {
                            assets.push({ image: imageBase64, context });
                        })
                        .catch(err => {
                             console.warn("Could not render a table from DOCX:", err);
                        });
                    renderPromises.push(promise);
                }
            }
        }
        
        await Promise.all(renderPromises);
        
        document.body.removeChild(tempDiv);
        return assets;

    } catch (error) {
        console.error("Error processing DOCX file:", error);
        throw new Error("Failed to extract elements from DOCX. The file may be corrupt, password-protected, or in an unsupported format.");
    }
};