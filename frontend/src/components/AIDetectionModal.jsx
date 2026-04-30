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
  "facebook/roberta-hate-speech-dynabench-r4-target": {
    LABEL_0: "Not Hate",
    LABEL_1: "Hate",
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

const AIDetectionModal = ({ result, isRechecking, onClose, onRecheck }) => {
  if (!result) return null;

  const isImageResult = Boolean(result.attachment);
  const isLinkResult = result.checkType === "link";
  const checkedLabel = isImageResult
    ? result.attachment?.name || "Image"
    : isLinkResult
      ? "Message links"
      : "Message text";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isImageResult ? "AI Image Detection" : isLinkResult ? "Suspicious Link Detection" : "AI Text Detection"}
            </h2>
            <p className="text-sm opacity-70">
              {checkedLabel} checked at {new Date(result.analysis.checkedAt).toLocaleString()}
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

        {isImageResult ? (
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
        ) : (
          <>
            <div className="rounded-2xl bg-base-200 p-4 text-sm">
              <p className="mb-2 font-medium">Checked text</p>
              <p className="whitespace-pre-wrap break-words opacity-80">{result.text}</p>
            </div>
            <TextDetectionSummaryCard
              summary={result.analysis.moderation.summary}
              predictions={result.analysis.moderation.predictions}
              modelName={result.analysis.models.moderation}
              title="Text Moderation"
              riskLabel="Hate risk"
              safeLabel="Not hate score"
              riskValueKey="harmfulPercent"
              safeValueKey="safePercent"
            />
          </>
        )}

        <div className="rounded-2xl bg-base-200 p-4 text-sm opacity-80">
          These checks are on-demand and model-based. Treat flagged results as review signals, not
          final truth.
        </div>
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
