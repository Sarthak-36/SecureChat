import {
  DEFAULT_SUMMARIZATION_MODEL,
  DEFAULT_SUMMARIZATION_PROVIDER,
  FALLBACK_SUMMARIZATION_MODEL,
} from "./config.js";
import { ensureInferenceConfigured, getInferenceClient, getSummaryProviderInfo } from "./provider.js";
import { countWords, isSuspiciousSummaryResult, toPercent } from "./utils.js";

const runSummarization = async ({ text, model }) => {
  ensureInferenceConfigured();
  const approximateWordCount = countWords(text);
  const client = getInferenceClient();
  const providerInfo = getSummaryProviderInfo();

  if (model.includes("flan-t5")) {
        const prompt = [
            "Summarize the following chat message in one short sentence.",
            "Keep only the key point and remove filler.",
            "",
            `Message: ${text}`,
            "Summary:",
        ].join("\n");

          try {
              const generated = await client.textGeneration({
              provider: providerInfo.providerPreference,
                  model,
                  inputs: prompt,
                parameters: {
                    do_sample: false,
                    return_full_text: false,
                    max_new_tokens: Math.min(
                        48,
                        Math.max(18, Math.ceil(approximateWordCount * 0.45)),
                    ),
                    repetition_penalty: 1.05,
                },
            });

            const generatedText =
                typeof generated === "string" ? generated : generated?.generated_text || "";
            const summaryText = generatedText
                .trim()
                .replace(/^summary:\s*/i, "")
                .trim();

            if (!summaryText) {
                const error = new Error(
                    `Unexpected summarization response: ${JSON.stringify(generated)}`,
                );
                error.statusCode = 502;
                error.publicMessage = "Summarization returned an unexpected response";
                throw error;
            }

          return {
              summaryText,
              providerInfo,
          };
      } catch (error) {
          const wrappedError = new Error(
              `Summarization request failed for ${model}: ${error.message}`,
            );
            wrappedError.statusCode = error.response?.status || error.statusCode || 502;
            wrappedError.publicMessage = "Summarization could not analyze this message right now";
            wrappedError.providerError = error.message;
            throw wrappedError;
        }
    }

    const maxLength = Math.min(80, Math.max(24, Math.ceil(approximateWordCount * 0.7)));
    const minLength = Math.min(16, Math.max(5, Math.floor(approximateWordCount * 0.22)));

    try {
        const result = await client.summarization({
          provider: providerInfo.providerPreference,
            model,
            inputs: text,
            parameters: {
                do_sample: false,
                max_length: maxLength,
                min_length: minLength,
            },
        });

        const summaryText = result?.summary_text?.trim() || result?.generated_text?.trim() || "";

        if (!summaryText) {
            const error = new Error(`Unexpected summarization response: ${JSON.stringify(result)}`);
            error.statusCode = 502;
            error.publicMessage = "Summarization returned an unexpected response";
            throw error;
        }

      return {
          summaryText,
          providerInfo,
      };
  } catch (error) {
      const wrappedError = new Error(
          `Summarization request failed for ${model}: ${error.message}`,
        );
        wrappedError.statusCode = error.response?.status || error.statusCode || 502;
        wrappedError.publicMessage = "Summarization could not analyze this message right now";
        wrappedError.providerError = error.message;
        throw wrappedError;
    }
};

export async function summarizeTextContent({ text }) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const originalWordCount = countWords(normalizedText);

    if (originalWordCount <= 5) {
        return {
            checkedAt: new Date().toISOString(),
            models: {
                summarization: "short-text shortcut",
            },
            attempts: [
                {
                    model: "short-text shortcut",
                    status: "skipped",
                    resolvedProvider: null,
                    providerPreference: null,
                    reason: "Message already too short to summarize further.",
                },
            ],
            summaryText: normalizedText,
            originalWordCount,
            summaryWordCount: originalWordCount,
            compressionPercent: 0,
            note: "This message is already extremely short, so the summary stays the same.",
        };
    }

    const candidateModels = [DEFAULT_SUMMARIZATION_MODEL, FALLBACK_SUMMARIZATION_MODEL].filter(
        (model, index, allModels) => allModels.indexOf(model) === index,
    );
    const attempts = [];
    let summaryText = null;
    let usedModel = DEFAULT_SUMMARIZATION_MODEL;
    let usedProvider = null;
    let providerPreferenceUsed = null;

    for (const model of candidateModels) {
        try {
            const candidateResult = await runSummarization({
                text: normalizedText,
                model,
            });
            const candidateSummary = candidateResult.summaryText;

            if (
                isSuspiciousSummaryResult({
                    sourceText: normalizedText,
                    summaryText: candidateSummary,
                })
            ) {
                attempts.push({
                    model,
                    status: "rejected",
                    resolvedProvider: candidateResult.providerInfo?.resolvedProvider || null,
                    providerPreference: candidateResult.providerInfo?.providerPreference || null,
                    reason: "Suspicious summary output",
                });
                continue;
            }

            summaryText = candidateSummary;
            usedModel = model;
            usedProvider = candidateResult.providerInfo?.resolvedProvider || null;
            providerPreferenceUsed = candidateResult.providerInfo?.providerPreference || null;
            attempts.push({
                model,
                status: "used",
                resolvedProvider: usedProvider,
                providerPreference: providerPreferenceUsed,
                reason: null,
            });
            break;
        } catch (error) {
            attempts.push({
                model,
                status: "failed",
                resolvedProvider: null,
                providerPreference: DEFAULT_SUMMARIZATION_PROVIDER,
                reason: error.providerError || error.message,
            });
        }
    }

    if (!summaryText) {
        const error = new Error(
            `Summarization failed for all configured models: ${attempts
                .map((attempt) => `${attempt.model}: ${attempt.reason || attempt.status}`)
                .join(" | ")}`,
        );
        error.statusCode = 502;
        error.publicMessage = "Summarization could not analyze this message right now";
        throw error;
    }

    const summaryWordCount = countWords(summaryText);
    const compressionRatio = originalWordCount
        ? Math.max(0, 1 - summaryWordCount / originalWordCount)
        : 0;

    return {
        checkedAt: new Date().toISOString(),
        models: {
            summarization: usedModel,
        },
        provider: {
            preference: providerPreferenceUsed,
            resolved: usedProvider,
        },
        attempts,
        summaryText,
        originalWordCount,
        summaryWordCount,
        compressionPercent: toPercent(compressionRatio),
        note: null,
    };
}
