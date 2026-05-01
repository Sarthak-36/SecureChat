const detectionToneByStatus = {
  high_risk: "badge-error",
  review: "badge-warning",
  clear: "badge-success",
  likely_ai: "badge-warning",
  possible_ai: "badge-warning",
  likely_real: "badge-success",
  block_review: "badge-error",
  needs_review: "badge-warning",
};

const legacyModelLabelMappings = {
  "Hello-SimpleAI/chatgpt-detector-roberta": {
    LABEL_0: "Human",
    LABEL_1: "ChatGPT",
  },
  "ealvaradob/bert-finetuned-phishing": {
    LABEL_0: "Benign",
    LABEL_1: "Phishing",
  },
  "mrm8488/bert-tiny-finetuned-sms-spam-detection": {
    LABEL_0: "Ham",
    LABEL_1: "Spam",
  },
};

const prettifyFallbackLabel = (label = "") =>
  label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getReadableLabel = (prediction, modelName) => {
  if (!prediction) return "Unavailable";
  if (prediction.displayLabel) return prediction.displayLabel;
  if (legacyModelLabelMappings[modelName]?.[prediction.label]) {
    return legacyModelLabelMappings[modelName][prediction.label];
  }
  return prettifyFallbackLabel(prediction.label || "Unavailable");
};

const LinkOverallResultCard = ({ overall, phishingSummary, reputationSummary, extractedLinks = [] }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">Link safety result</h3>
        <p className="mt-1 text-sm opacity-80">{overall?.message}</p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[overall?.status] || "badge-ghost"
        }`}
      >
        {overall?.label || "No summary"}
      </span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Phishing risk</p>
        <p className="text-lg font-semibold">{phishingSummary?.phishingPercent ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Reputation flags</p>
        <p className="text-lg font-semibold">{reputationSummary?.flaggedCount ?? 0}</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Links found</p>
        <p className="text-lg font-semibold">{extractedLinks.length}</p>
      </div>
    </div>
  </div>
);

const ReputationSummaryCard = ({ reputationSummary, modelName }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">URL Reputation</h3>
        <p className="text-sm opacity-70">{modelName}</p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[reputationSummary?.status] || "badge-ghost"
        }`}
      >
        {reputationSummary?.label || "No summary"}
      </span>
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Flagged links</p>
        <p className="text-lg font-semibold">{reputationSummary?.flaggedCount ?? 0}</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Configured</p>
        <p className="text-lg font-semibold">{reputationSummary?.configured ? "Yes" : "No"}</p>
      </div>
    </div>

    {reputationSummary?.matches?.length ? (
      <div className="mt-3 space-y-2">
        {reputationSummary.matches.slice(0, 4).map((match, index) => (
          <div key={`${match.url}-${match.threatType}-${index}`} className="rounded-xl bg-base-100 px-3 py-2 text-sm">
            <p className="break-all font-medium">{match.url}</p>
            <p className="mt-1 opacity-70">
              {match.threatType.replace(/_/g, " ")} on {match.platformType.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm opacity-70">
        {reputationSummary?.configured
          ? "No Safe Browsing matches found for the extracted links."
          : "Set GOOGLE_SAFE_BROWSING_API_KEY in the backend to enable domain reputation checks."}
      </p>
    )}
  </div>
);

const LinkResultCard = ({ linkResult, modelName }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold break-all">{linkResult.url}</h3>
        <p className="text-sm opacity-70">
          Top result: {getReadableLabel(linkResult.summary?.topPrediction, modelName)}
        </p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[linkResult.summary?.status] || "badge-ghost"
        }`}
      >
        {linkResult.summary?.status?.replace(/_/g, " ") || "unknown"}
      </span>
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Phishing risk</p>
        <p className="text-lg font-semibold">{linkResult.summary?.phishingPercent ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Safe score</p>
        <p className="text-lg font-semibold">{linkResult.summary?.safePercent ?? 0}%</p>
      </div>
    </div>

    <div className="mt-3 space-y-2">
      {linkResult.predictions.slice(0, 3).map((prediction) => (
        <div key={`${linkResult.url}-${prediction.label}`} className="flex items-center justify-between text-sm">
          <span className="truncate">{getReadableLabel(prediction, modelName)}</span>
          <span className="font-medium">{prediction.percent}%</span>
        </div>
      ))}
    </div>
  </div>
);

const DetectionSummaryCard = ({ title, summary, predictions = [], modelName }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm opacity-70">
          Top result: {getReadableLabel(summary?.topPrediction, modelName)}
        </p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[summary?.status] || "badge-ghost"
        }`}
      >
        {summary?.status?.replace(/_/g, " ") || "unknown"}
      </span>
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {"riskPercent" in (summary || {}) ? (
        <>
          <div className="rounded-xl bg-base-100 px-3 py-2">
            <p className="text-xs uppercase tracking-wide opacity-60">NSFW risk</p>
            <p className="text-lg font-semibold">{summary.riskPercent}%</p>
          </div>
          <div className="rounded-xl bg-base-100 px-3 py-2">
            <p className="text-xs uppercase tracking-wide opacity-60">Safe score</p>
            <p className="text-lg font-semibold">{summary.safePercent}%</p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-base-100 px-3 py-2">
            <p className="text-xs uppercase tracking-wide opacity-60">AI generated</p>
            <p className="text-lg font-semibold">{summary?.aiPercent ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-base-100 px-3 py-2">
            <p className="text-xs uppercase tracking-wide opacity-60">Human score</p>
            <p className="text-lg font-semibold">{summary?.humanPercent ?? 0}%</p>
          </div>
        </>
      )}
    </div>

    <div className="mt-3 space-y-2">
      {predictions.slice(0, 3).map((prediction) => (
        <div key={prediction.label} className="flex items-center justify-between text-sm">
          <span className="truncate">{getReadableLabel(prediction, modelName)}</span>
          <span className="font-medium">{prediction.percent}%</span>
        </div>
      ))}
    </div>
  </div>
);

const ImageOverallResultCard = ({ overall, nsfwSummary, aiSummary }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">Final result</h3>
        <p className="mt-1 text-sm opacity-80">{overall?.message}</p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[overall?.status] || "badge-ghost"
        }`}
      >
        {overall?.label || "No summary"}
      </span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">NSFW risk</p>
        <p className="text-lg font-semibold">{nsfwSummary?.riskPercent ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">AI generated</p>
        <p className="text-lg font-semibold">{aiSummary?.aiPercent ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Human score</p>
        <p className="text-lg font-semibold">{aiSummary?.humanPercent ?? 0}%</p>
      </div>
    </div>
  </div>
);

const TextOverallResultCard = ({ overall, summary }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">Final result</h3>
        <p className="mt-1 text-sm opacity-80">{overall?.message}</p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[overall?.status] || "badge-ghost"
        }`}
      >
        {overall?.label || "No summary"}
      </span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">AI generated</p>
        <p className="text-lg font-semibold">{summary?.aiPercent ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">Human score</p>
        <p className="text-lg font-semibold">{summary?.humanPercent ?? 0}%</p>
      </div>
    </div>
  </div>
);

const TextDetectionSummaryCard = ({
  summary,
  predictions = [],
  modelName,
  title = "Text Moderation",
  riskLabel = "Harmful risk",
  safeLabel = "Safe score",
  riskValueKey = "harmfulPercent",
  safeValueKey = "safePercent",
}) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm opacity-70">
          Top result: {getReadableLabel(summary?.topPrediction, modelName)}
        </p>
      </div>
      <span
        className={`badge h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${
          detectionToneByStatus[summary?.status] || "badge-ghost"
        }`}
      >
        {summary?.status?.replace(/_/g, " ") || "unknown"}
      </span>
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">{riskLabel}</p>
        <p className="text-lg font-semibold">{summary?.[riskValueKey] ?? 0}%</p>
      </div>
      <div className="rounded-xl bg-base-100 px-3 py-2">
        <p className="text-xs uppercase tracking-wide opacity-60">{safeLabel}</p>
        <p className="text-lg font-semibold">{summary?.[safeValueKey] ?? 0}%</p>
      </div>
    </div>

    <div className="mt-3 space-y-2">
      {predictions.slice(0, 4).map((prediction) => (
        <div key={prediction.label} className="flex items-center justify-between text-sm">
          <span className="truncate">{getReadableLabel(prediction, modelName)}</span>
          <span className="font-medium">{prediction.percent}%</span>
        </div>
      ))}
    </div>
  </div>
);

const SummaryResultCard = ({ summary, sourceText }) => (
  <div className="space-y-4">
    <div className="rounded-2xl bg-base-200 p-4 text-sm">
      <p className="mb-2 font-medium">Original text</p>
      <p className="whitespace-pre-wrap break-words opacity-80">{sourceText}</p>
    </div>

    <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold">Summary</h3>
          <p className="mt-1 text-sm opacity-80">
            A shorter version of the message generated by the summarization model.
          </p>
        </div>
        <span className="badge badge-success h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right">
          Ready
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-base-100 px-4 py-3">
        <p className="whitespace-pre-wrap break-words">{summary?.summaryText}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-base-100 px-3 py-2">
          <p className="text-xs uppercase tracking-wide opacity-60">Original words</p>
          <p className="text-lg font-semibold">{summary?.originalWordCount ?? 0}</p>
        </div>
        <div className="rounded-xl bg-base-100 px-3 py-2">
          <p className="text-xs uppercase tracking-wide opacity-60">Summary words</p>
          <p className="text-lg font-semibold">{summary?.summaryWordCount ?? 0}</p>
        </div>
        <div className="rounded-xl bg-base-100 px-3 py-2">
          <p className="text-xs uppercase tracking-wide opacity-60">Compression</p>
          <p className="text-lg font-semibold">{summary?.compressionPercent ?? 0}%</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-base-100 px-3 py-3 text-sm">
        <p className="font-medium">Model info</p>
        <p className="mt-1 opacity-80">Used model: {summary?.models?.summarization || "Unknown"}</p>
        <p className="opacity-80">
          Resolved provider: {summary?.provider?.resolved || summary?.provider?.preference || "Unknown"}
        </p>
      </div>

      {summary?.attempts?.length ? (
        <div className="mt-4 rounded-xl bg-base-100 px-3 py-3 text-sm">
          <p className="font-medium">Attempt history</p>
          <div className="mt-2 space-y-2">
            {summary.attempts.map((attempt) => (
              <div key={`${attempt.model}-${attempt.status}`} className="rounded-lg bg-base-200 px-3 py-2">
                <p className="font-medium break-all">{attempt.model}</p>
                <p className="opacity-80">
                  {attempt.status}
                  {attempt.resolvedProvider ? ` via ${attempt.resolvedProvider}` : ""}
                </p>
                {attempt.reason ? <p className="opacity-70">{attempt.reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary?.note ? <p className="mt-3 text-sm opacity-70">{summary.note}</p> : null}
    </div>
  </div>
);

const ImageDescriptionCard = ({ attachment, description }) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold">Image description</h3>
          <p className="mt-1 text-sm opacity-80">
            An AI-generated description of the uploaded image.
          </p>
        </div>
        <span className="badge badge-success h-auto max-w-full self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right">
          Ready
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-base-100 px-4 py-3">
        <p className="whitespace-pre-wrap break-words">{description?.descriptionText}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-base-100 px-3 py-2">
          <p className="text-xs uppercase tracking-wide opacity-60">Attachment</p>
          <p className="text-sm font-medium break-all">{attachment?.name || "Image"}</p>
        </div>
        <div className="rounded-xl bg-base-100 px-3 py-2">
          <p className="text-xs uppercase tracking-wide opacity-60">Type</p>
          <p className="text-sm font-medium">{attachment?.mimeType || "image"}</p>
        </div>
      </div>

      {description?.note ? <p className="mt-3 text-sm opacity-70">{description.note}</p> : null}
    </div>
  </div>
);

const AIDetectionModal = ({ result, isRechecking, onClose, onRecheck }) => {
  if (!result) return null;

  const isImageDetectionResult = result.checkType === "image";
  const isLinkResult = result.checkType === "link";
  const isSummaryResult = result.checkType === "summarize";
  const isImageDescriptionResult = result.checkType === "describe_image";
  const checkedLabel = isImageDetectionResult || isImageDescriptionResult
    ? result.attachment?.name || "Image"
    : isLinkResult
      ? "Message links"
      : isSummaryResult
        ? "Message summary"
        : "Message text";
  const resultTitle = isImageDetectionResult
    ? "AI Image Detection"
    : isLinkResult
      ? "Suspicious Link Detection"
      : isSummaryResult
        ? "Text Summary"
        : isImageDescriptionResult
          ? "Image Description"
          : "AI Text Detection";
  const checkedAt =
    result.analysis?.checkedAt || result.summary?.checkedAt || result.description?.checkedAt;
  const helperText =
    isSummaryResult || isImageDescriptionResult
      ? "These results are generated on demand and cached for reuse. Recheck if you want a fresh result."
      : "These checks are on-demand and model-based. Treat flagged results as review signals, not final truth.";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{resultTitle}</h2>
            <p className="text-sm opacity-70">
              {checkedLabel} checked at {new Date(checkedAt).toLocaleString()}
            </p>
            <p className="mt-1 text-xs opacity-60">
              {result.cached ? "Showing saved result" : "Freshly checked just now"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onRecheck}
              disabled={isRechecking}
            >
              {isRechecking ? "Rechecking..." : "Recheck"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {isImageDetectionResult ? (
          <>
            <ImageOverallResultCard
              overall={result.analysis.overall}
              nsfwSummary={result.analysis.nsfw.summary}
              aiSummary={result.analysis.aiGenerated.summary}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <DetectionSummaryCard
                title="NSFW and Harmful Content"
                summary={result.analysis.nsfw.summary}
                predictions={result.analysis.nsfw.predictions}
                modelName={result.analysis.models.nsfw}
              />
              <DetectionSummaryCard
                title="AI-Generated Image Check"
                summary={result.analysis.aiGenerated.summary}
                predictions={result.analysis.aiGenerated.predictions}
                modelName={result.analysis.models.aiGenerated}
              />
            </div>
          </>
        ) : isLinkResult ? (
          <>
            <div className="rounded-2xl bg-base-200 p-4 text-sm">
              <p className="mb-2 font-medium">Checked text</p>
              <p className="whitespace-pre-wrap break-words opacity-80">{result.text}</p>
            </div>
            <LinkOverallResultCard
              overall={result.analysis.overall}
              phishingSummary={result.analysis.phishing.summary}
              reputationSummary={result.analysis.reputation}
              extractedLinks={result.extractedLinks}
            />
            <div className="space-y-4">
              <ReputationSummaryCard
                reputationSummary={result.analysis.reputation}
                modelName={result.analysis.models.reputation}
              />
              {result.analysis.links.map((linkResult) => (
                <LinkResultCard
                  key={linkResult.url}
                  linkResult={linkResult}
                  modelName={result.analysis.models.phishing}
                />
              ))}
            </div>
          </>
        ) : isSummaryResult ? (
          <SummaryResultCard
            summary={{
              ...result.summary,
              models: result.summary?.models || result.models,
            }}
            sourceText={result.text}
          />
        ) : isImageDescriptionResult ? (
          <ImageDescriptionCard attachment={result.attachment} description={result.description} />
        ) : (
          <>
            <div className="rounded-2xl bg-base-200 p-4 text-sm">
              <p className="mb-2 font-medium">Checked text</p>
              <p className="whitespace-pre-wrap break-words opacity-80">{result.text}</p>
            </div>
            <TextOverallResultCard
              overall={result.analysis.overall}
              summary={result.analysis.aiGeneratedText.summary}
            />
            <TextDetectionSummaryCard
              summary={result.analysis.aiGeneratedText.summary}
              predictions={result.analysis.aiGeneratedText.predictions}
              modelName={result.analysis.models.aiGeneratedText}
              title="AI Text Detection"
              riskLabel="AI generated"
              safeLabel="Human score"
              riskValueKey="aiPercent"
              safeValueKey="humanPercent"
            />
          </>
        )}

        <div className="rounded-2xl bg-base-200 p-4 text-sm opacity-80">{helperText}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
};

export default AIDetectionModal;
