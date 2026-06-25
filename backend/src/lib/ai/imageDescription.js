import sharp from "sharp";

import {
  DEFAULT_IMAGE_DESCRIPTION_MODEL,
  DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL,
  ENABLE_LEGACY_IMAGE_DESCRIPTION_MODELS,
  FALLBACK_IMAGE_DESCRIPTION_MODEL,
  HF_CHAT_COMPLETIONS_URL,
  HF_DIRECT_INFERENCE_API_BASE_URL,
  IMAGE_DESCRIPTION_INLINE_IMAGE_MAX_BYTES,
  IMAGE_DESCRIPTION_TIMEOUT_MS,
} from "./config.js";
import { ensureInferenceConfigured, parseInferenceError } from "./provider.js";

export const runImageToText = async ({ buffer, mimeType, model }) => {
    ensureInferenceConfigured();

    const parseDescriptionText = (payload) => {
        const normalizedPayload = Array.isArray(payload) ? payload[0] : payload;
        return normalizedPayload?.generated_text?.trim() || normalizedPayload?.text?.trim() || "";
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_DESCRIPTION_TIMEOUT_MS);

    try {
        const response = await fetch(`${HF_DIRECT_INFERENCE_API_BASE_URL}/${model}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": mimeType || "application/octet-stream",
                Accept: "application/json",
            },
            body: buffer,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorMessage = await parseInferenceError(response);
            const error = new Error(`Inference request failed for ${model}: ${errorMessage}`);
            error.statusCode = response.status;
            error.publicMessage = "Image description could not analyze this image right now";
            throw error;
        }

        const payload = await response.json();
        const descriptionText = parseDescriptionText(payload);

        if (!descriptionText) {
            const error = new Error(
                `Unexpected image description response: ${JSON.stringify(payload)}`,
            );
            error.statusCode = 502;
            error.publicMessage = "Image description returned an unexpected response";
            throw error;
        }

        return {
            descriptionText,
            provider: "hf-inference",
        };
    } catch (error) {
        const wrappedError = new Error(
            `Image description request failed for ${model}: ${error.message}`,
        );
        wrappedError.statusCode = error.response?.status || error.statusCode || 502;
        wrappedError.publicMessage = "Image description could not analyze this image right now";
        wrappedError.providerError =
            error.name === "AbortError"
                ? `Timed out after ${IMAGE_DESCRIPTION_TIMEOUT_MS}ms`
                : error.message || "Unknown inference error";
        throw wrappedError;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const runVisionChatImageDescription = async ({ attachmentUrl, buffer, mimeType, model }) => {
    ensureInferenceConfigured();

    const buildInlineImageDataUrl = async () => {
        const candidates = [
            { width: 768, quality: 60 },
            { width: 640, quality: 50 },
            { width: 512, quality: 40 },
        ];

        for (const candidate of candidates) {
            const optimizedBuffer = await sharp(buffer)
                .rotate()
                .resize({
                    width: candidate.width,
                    height: candidate.width,
                    fit: "inside",
                    withoutEnlargement: true,
                })
                .webp({ quality: candidate.quality })
                .toBuffer();

            if (optimizedBuffer.length <= IMAGE_DESCRIPTION_INLINE_IMAGE_MAX_BYTES) {
                return `data:image/webp;base64,${optimizedBuffer.toString("base64")}`;
            }
        }

        const fallbackBuffer = await sharp(buffer)
            .rotate()
            .resize({
                width: 384,
                height: 384,
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 35 })
            .toBuffer();

        return `data:image/webp;base64,${fallbackBuffer.toString("base64")}`;
    };

    const canUseRemoteUrl =
        typeof attachmentUrl === "string" && /^https:\/\//i.test(attachmentUrl);
    const imageReference = canUseRemoteUrl
        ? attachmentUrl
        : await buildInlineImageDataUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_DESCRIPTION_TIMEOUT_MS);

    try {
        const response = await fetch(HF_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe this image in one concise sentence. Mention the main subject and any important visible details.",
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageReference,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 120,
                temperature: 0.2,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorMessage = await parseInferenceError(response);
            const error = new Error(`Vision chat request failed for ${model}: ${errorMessage}`);
            error.statusCode = response.status;
            error.publicMessage = "Image description could not analyze this image right now";
            throw error;
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        const descriptionText =
            typeof content === "string"
                ? content.trim()
                : Array.isArray(content)
                  ? content
                      .map((item) => (typeof item?.text === "string" ? item.text.trim() : ""))
                      .filter(Boolean)
                      .join(" ")
                      .trim()
                  : "";

        if (!descriptionText) {
            const error = new Error(`Unexpected vision chat response: ${JSON.stringify(payload)}`);
            error.statusCode = 502;
            error.publicMessage = "Image description returned an unexpected response";
            throw error;
        }

        return {
            descriptionText,
            provider: model.includes(":") ? model.split(":").pop() : "hf-router",
        };
    } catch (error) {
        const wrappedError = new Error(
            error.name === "AbortError"
                ? `Vision chat request failed for ${model}: Timed out after ${IMAGE_DESCRIPTION_TIMEOUT_MS}ms`
                : error.message,
        );
        wrappedError.statusCode = error.statusCode || 502;
        wrappedError.publicMessage = "Image description could not analyze this image right now";
        wrappedError.providerError = wrappedError.message;
        throw wrappedError;
    } finally {
        clearTimeout(timeoutId);
    }
};

export async function describeImageContent({ buffer, mimeType, attachmentName, attachmentUrl }) {
    const candidateModels = ENABLE_LEGACY_IMAGE_DESCRIPTION_MODELS
        ? [DEFAULT_IMAGE_DESCRIPTION_MODEL, FALLBACK_IMAGE_DESCRIPTION_MODEL].filter(
              (model, index, allModels) => allModels.indexOf(model) === index,
          )
        : [];
    const attempts = [];
    let usedModel = DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL;
    let usedProvider = null;
    let descriptionText = null;

    try {
        const result = await runVisionChatImageDescription({
            attachmentUrl,
            buffer,
            mimeType,
            model: DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL,
        });
        descriptionText = result.descriptionText;
        usedModel = DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL;
        usedProvider = result.provider;
        attempts.push({
            model: DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL,
            status: "used",
            provider: result.provider,
            reason: null,
        });
    } catch (error) {
        attempts.push({
            model: DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL,
            status: "failed",
            provider: "hf-router",
            reason: error.providerError || error.message,
        });
    }

    for (const model of candidateModels) {
        if (descriptionText) break;
        try {
            const result = await runImageToText({
                buffer,
                mimeType,
                model,
            });
            descriptionText = result.descriptionText;
            usedModel = model;
            usedProvider = result.provider;
            attempts.push({
                model,
                status: "used",
                provider: usedProvider,
                reason: null,
            });
            break;
        } catch (error) {
            attempts.push({
                model,
                status: "failed",
                provider: "hf-inference",
                reason: error.providerError || error.message,
            });
        }
    }

    if (!descriptionText) {
        const error = new Error(
            `Image description failed for all configured models: ${attempts
                .map((attempt) => `${attempt.model}: ${attempt.reason || attempt.status}`)
                .join(" | ")}`
        );
        error.statusCode = 502;
        error.publicMessage = "Image description could not analyze this image right now";
        throw error;
    }

    return {
        checkedAt: new Date().toISOString(),
        models: {
            imageDescription: usedModel,
        },
        descriptionText,
        provider: {
            preference: "hf-inference",
            resolved: usedProvider,
        },
        attempts,
        attachmentName: attachmentName || null,
        note: "This is an AI-generated description of the uploaded image.",
    };
}
