// check if the image url is valid
export const checkImageUrl = (signedUrl: string) => {
  try {
    const url = new URL(signedUrl);

    // Extract expiration and signing timestamp
    const amzDate = url.searchParams.get("X-Amz-Date");
    const amzExpires = url.searchParams.get("X-Amz-Expires");

    if (!amzDate || !amzExpires) {
      console.error("Invalid signed URL: Missing expiration details.");
      return false;
    }

    // Convert X-Amz-Date into a proper Date object
    const signedDate = new Date(
      amzDate.slice(0, 4) + // Year
        "-" +
        amzDate.slice(4, 6) + // Month
        "-" +
        amzDate.slice(6, 8) + // Day
        "T" +
        amzDate.slice(9, 11) + // Hour
        ":" +
        amzDate.slice(11, 13) + // Minute
        ":" +
        amzDate.slice(13, 15) + // Second
        "Z"
    );

    // Calculate the expiration time in milliseconds
    const expiresInMs = parseInt(amzExpires) * 1000;
    const expirationDate = new Date(signedDate.getTime() + expiresInMs);

    // Compare expiration time with the current time
    const isValid = Date.now() < expirationDate.getTime();
    return isValid;
  } catch (error) {
    console.error("Error validating signed URL:", error);
    return false; // Assume invalid if any error occurs
  }
};
