import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { importConfig } from "../config.js";

/**
 * Image processing module for property imports
 * Handles downloading, processing, and uploading images to Supabase storage
 */

// Initialize Supabase client for storage operations
const supabase = createClient(
    importConfig.supabaseUrl,
    importConfig.supabaseServiceRoleKey
);

// Configure Sharp for optimal performance in batch processing
sharp.cache(false);
sharp.concurrency(1);

/**
 * Downloads an image from a URL
 * @param {string} url - Image URL to download
 * @returns {Promise<Buffer>} Image buffer
 */
export async function downloadImage(url) {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000; // 15 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const response = await fetch(url, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Image not found (404): ${url}`);
                } else if (response.status === 403) {
                    throw new Error(`Access forbidden (403): ${url}`);
                } else if (response.status >= 500) {
                    // Retry on 5xx errors
                    throw new Error(
                        `Server error (${response.status}): ${url}`
                    );
                } else {
                    throw new Error(
                        `HTTP error ${response.status}: ${url}`
                    );
                }
            }

            // Verify content type
            const contentType = response.headers.get("content-type");
            if (
                contentType &&
                !contentType.startsWith("image/")
            ) {
                throw new Error(
                    `Invalid content type: ${contentType} for ${url}`
                );
            }

            // Convert to buffer
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log(
                `✓ Downloaded image: ${url} (${(buffer.length / 1024).toFixed(1)} KB)`
            );

            return buffer;
        } catch (error) {
            const isLastAttempt = attempt === MAX_RETRIES;
            const shouldRetry =
                error.name === "AbortError" ||
                error.message.includes("Server error") ||
                error.message.includes("fetch failed");

            if (!isLastAttempt && shouldRetry) {
                // Exponential backoff: 1s, 2s, 4s
                const backoffMs = Math.pow(2, attempt - 1) * 1000;
                console.warn(
                    `⚠️  Download attempt ${attempt} failed for ${url}: ${error.message}. Retrying in ${backoffMs}ms...`
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, backoffMs)
                );
            } else {
                console.error(
                    `✗ Failed to download image after ${attempt} attempt(s): ${url}`,
                    error.message
                );
                throw error;
            }
        }
    }
}

/**
 * Processes an image buffer to generate multiple size variants
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<Array<{size: string, buffer: Buffer, format: string}>>} Array of processed image variants
 */
export async function processImage(imageBuffer) {
    try {
        // Detect image format from buffer
        const metadata = await sharp(imageBuffer).metadata();
        const format = metadata.format;

        if (!format || !["jpeg", "jpg", "png", "webp"].includes(format)) {
            throw new Error(
                `Unsupported image format: ${format || "unknown"}`
            );
        }

        // Define size configurations
        const sizes = [
            { name: "small", width: 300, quality: 60 },
            { name: "medium", width: 650, quality: 60 },
            { name: "large", width: 900, quality: 60 },
        ];

        // Process all sizes
        const processedImages = await Promise.all(
            sizes.map(async ({ name, width, quality }) => {
                let pipeline = sharp(imageBuffer).resize(width, null, {
                    fit: "inside",
                    withoutEnlargement: true,
                });

                // Apply format-specific compression
                if (format === "png") {
                    pipeline = pipeline.png({
                        compressionLevel: 6,
                        adaptiveFiltering: false,
                        quality: quality,
                    });
                } else if (format === "jpeg" || format === "jpg") {
                    pipeline = pipeline.jpeg({
                        quality: quality,
                    });
                } else if (format === "webp") {
                    pipeline = pipeline.webp({
                        quality: quality,
                    });
                }

                const buffer = await pipeline.toBuffer();

                return {
                    size: name,
                    buffer: buffer,
                    format: format === "jpg" ? "jpeg" : format,
                };
            })
        );

        console.log(
            `✓ Processed image into ${processedImages.length} sizes (${format})`
        );

        return processedImages;
    } catch (error) {
        console.error(`✗ Image processing failed:`, error.message);
        throw error;
    }
}

/**
 * Uploads an image buffer to Supabase storage
 * @param {Buffer} imageBuffer - Image buffer to upload
 * @param {Object} metadata - Metadata including size variant and format
 * @returns {Promise<{size: string, storageKey: string, publicUrl: string}>} Upload result
 */
export async function uploadToSupabase(imageBuffer, metadata) {
    const MAX_RETRIES = 3;
    const { size, format } = metadata;

    // Generate unique filename
    const uuid = uuidv4();
    const timestamp = Date.now();
    const extension = format === "jpeg" ? "jpg" : format;
    const filename = `${uuid}_${timestamp}-${size}.${extension}`;
    const storagePath = `properties/${filename}`;

    // Determine content type
    const contentTypeMap = {
        jpeg: "image/jpeg",
        jpg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
    };
    const contentType = contentTypeMap[extension] || "image/jpeg";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Upload to Supabase storage
            const { data, error } = await supabase.storage
                .from("imotko-prod")
                .upload(storagePath, imageBuffer, {
                    contentType: contentType,
                    cacheControl: "3600",
                    upsert: false,
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const {
                data: { publicUrl },
            } = supabase.storage
                .from("imotko-prod")
                .getPublicUrl(storagePath);

            console.log(
                `✓ Uploaded ${size} image: ${filename} (${(imageBuffer.length / 1024).toFixed(1)} KB)`
            );

            return {
                size: size,
                storageKey: storagePath,
                publicUrl: publicUrl,
            };
        } catch (error) {
            const isLastAttempt = attempt === MAX_RETRIES;

            if (!isLastAttempt) {
                // Exponential backoff: 1s, 2s, 4s
                const backoffMs = Math.pow(2, attempt - 1) * 1000;
                console.warn(
                    `⚠️  Upload attempt ${attempt} failed for ${filename}: ${error.message}. Retrying in ${backoffMs}ms...`
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, backoffMs)
                );
            } else {
                console.error(
                    `✗ Failed to upload image after ${attempt} attempt(s): ${filename}`,
                    error.message
                );
                throw error;
            }
        }
    }
}

/**
 * Processes all images for a property
 * Downloads, processes, and uploads images, returning photo JSON structure
 * @param {string[]} imageUrls - Array of image URLs to process
 * @returns {Promise<Array<{id: string, name: null, sizes: Object, s3Urls: string[]}>>} Photo JSON structure
 */
export async function processPropertyImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
        console.log("No images to process");
        return [];
    }

    console.log(`\n📸 Processing ${imageUrls.length} images...`);

    const MAX_CONCURRENT = 3;
    const photos = [];
    const errors = [];

    // Helper function to process a single image URL
    const processSingleImage = async (url, index) => {
        try {
            console.log(
                `\n[${index + 1}/${imageUrls.length}] Processing image: ${url}`
            );

            // Step 1: Download image
            const imageBuffer = await downloadImage(url);

            // Step 2: Process image (generate 3 sizes)
            const processedImages = await processImage(imageBuffer);

            // Step 3: Upload all sizes to Supabase
            const uploadResults = await Promise.all(
                processedImages.map((img) =>
                    uploadToSupabase(img.buffer, {
                        size: img.size,
                        format: img.format,
                    })
                )
            );

            // Step 4: Generate photo JSON structure
            const photoId = uuidv4();
            const sizes = {};
            const s3Urls = [];

            uploadResults.forEach((result) => {
                sizes[result.size] = result.publicUrl;
                s3Urls.push(result.storageKey);
            });

            const photoObject = {
                id: photoId,
                name: null,
                sizes: sizes,
                s3Urls: s3Urls,
            };

            console.log(
                `✓ Successfully processed image ${index + 1}/${imageUrls.length}`
            );

            return photoObject;
        } catch (error) {
            console.error(
                `✗ Failed to process image ${index + 1}/${imageUrls.length}: ${url}`,
                error.message
            );
            errors.push({
                url: url,
                index: index,
                error: error.message,
            });
            return null;
        }
    };

    // Process images with concurrency limit
    for (let i = 0; i < imageUrls.length; i += MAX_CONCURRENT) {
        const batch = imageUrls.slice(i, i + MAX_CONCURRENT);
        const batchResults = await Promise.all(
            batch.map((url, batchIndex) =>
                processSingleImage(url, i + batchIndex)
            )
        );

        // Add successful results to photos array
        batchResults.forEach((result) => {
            if (result !== null) {
                photos.push(result);
            }
        });
    }

    // Summary logging
    console.log(`\n📸 Image processing complete:`);
    console.log(`   ✓ Successful: ${photos.length}/${imageUrls.length}`);
    console.log(`   ✗ Failed: ${errors.length}/${imageUrls.length}`);

    if (errors.length > 0) {
        console.log(`\n⚠️  Failed images:`);
        errors.forEach((err) => {
            console.log(`   - [${err.index + 1}] ${err.url}: ${err.error}`);
        });
    }

    return photos;
}
