/**
 * Fetches an image from a URL and converts it to a base64 data string.
 * Note: This will be subject to CORS policies. If the image server doesn't
 * allow cross-origin requests, this fetch will fail.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves to the base64 data URL of the image.
 */
export const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image. Status: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();

    if (!blob.type.startsWith('image/')) {
        throw new Error(`The fetched file is not an image. MIME type: ${blob.type}`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob as a data URL.'));
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image from URL:', error);
    let errorMessage = 'Could not fetch the image from the provided URL.';
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage += ' This may be due to a network error or a CORS policy restriction on the server.';
    } else if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
};
