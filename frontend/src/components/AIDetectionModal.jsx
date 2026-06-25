import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

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

const statusIconByStatus = {
  high_risk: AlertTriangleIcon,
  review: AlertTriangleIcon,
  clear: CheckCircle2Icon,
  likely_ai: SparklesIcon,
  possible_ai: AlertTriangleIcon,
  likely_real: CheckCircle2Icon,
  block_review: AlertTriangleIcon,
  needs_review: AlertTriangleIcon,
};

const getStatusToneClass = (status) => detectionToneByStatus[status] || "badge-ghost";

const StatusBadge = ({ status, label }) => {
  const Icon = statusIconByStatus[status] || ShieldCheckIcon;

  return (
    <span
      className={`badge h-auto max-w-full gap-1.5 self-start whitespace-normal px-3 py-2 text-left leading-tight sm:max-w-[12rem] sm:self-auto sm:text-right ${getStatusToneClass(
        status,
      )}`}
    >
      <Icon className="size-3.5 shrink-0" />
      {label || status?.replace(/_/g, " ") || "No summary"}
    </span>
  );
};

const MetricTile = ({ label, value, suffix = "", tone = "bg-base-100" }) => (
  <div className={`rounded-xl px-3 py-2 ${tone}`}>
    <p className="text-xs uppercase tracking-wide opacity-60">{label}</p>
    <p className="text-lg font-semibold">
      {value ?? 0}
      {suffix}
    </p>
  </div>
);

const ScoreRow = ({ label, percent = 0, modelName }) => (
  <div className="space-y-1.5 text-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="truncate">{label}</span>
      <span className="font-medium">{percent}%</span>
    </div>
    <progress className="progress progress-primary h-1.5 w-full" value={percent} max="100" />
    {modelName ? <p className="truncate text-[11px] opacity-55">{modelName}</p> : null}
  </div>
);

const LinkOverallResultCard = ({ overall, phishingSummary, reputationSummary, extractedLinks = [] }) => (
  <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">Link safety result</h3>
        <p className="mt-1 text-sm opacity-80">{overall?.message}</p>
      </div>
      <StatusBadge status={overall?.status} label={overall?.label} />
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <MetricTile label="Phishing risk" value={phishingSummary?.phishingPercent ?? 0} suffix="%" />
      <MetricTile label="Reputation flags" value={reputationSummary?.flaggedCount ?? 0} />
      <MetricTile label="Links found" value={extractedLinks.length} />
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
      <StatusBadge status={reputationSummary?.status} label={reputationSummary?.label} />
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <MetricTile label="Flagged links" value={reputationSummary?.flaggedCount ?? 0} />
      <MetricTile label="Configured" value={reputationSummary?.configured ? "Yes" : "No"} />
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
      <StatusBadge status={linkResult.summary?.status} />
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <MetricTile label="Phishing risk" value={linkResult.summary?.phishingPercent ?? 0} suffix="%" />
      <MetricTile label="Safe score" value={linkResult.summary?.safePercent ?? 0} suffix="%" />
    </div>

    <div className="mt-3 space-y-2">
      {(linkResult.predictions || []).slice(0, 3).map((prediction) => (
        <ScoreRow
          key={`${linkResult.url}-${prediction.label}`}
          label={getReadableLabel(prediction, modelName)}
          percent={prediction.percent}
        />
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
      <StatusBadge status={summary?.status} />
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {"riskPercent" in (summary || {}) ? (
        <>
          <MetricTile label="NSFW risk" value={summary.riskPercent} suffix="%" />
          <MetricTile label="Safe score" value={summary.safePercent} suffix="%" />
        </>
      ) : (
        <>
          <MetricTile label="AI generated" value={summary?.aiPercent ?? 0} suffix="%" />
          <MetricTile label="Human score" value={summary?.humanPercent ?? 0} suffix="%" />
        </>
      )}
    </div>

    <div className="mt-3 space-y-2">
      {predictions.slice(0, 3).map((prediction) => (
        <ScoreRow
          key={prediction.label}
          label={getReadableLabel(prediction, modelName)}
          percent={prediction.percent}
        />
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
      <StatusBadge status={overall?.status} label={overall?.label} />
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <MetricTile label="NSFW risk" value={nsfwSummary?.riskPercent ?? 0} suffix="%" />
      <MetricTile label="AI generated" value={aiSummary?.aiPercent ?? 0} suffix="%" />
      <MetricTile label="Human score" value={aiSummary?.humanPercent ?? 0} suffix="%" />
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
      <StatusBadge status={overall?.status} label={overall?.label} />
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <MetricTile label="AI generated" value={summary?.aiPercent ?? 0} suffix="%" />
      <MetricTile label="Human score" value={summary?.humanPercent ?? 0} suffix="%" />
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
      <StatusBadge status={summary?.status} />
    </div>

    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <MetricTile label={riskLabel} value={summary?.[riskValueKey] ?? 0} suffix="%" />
      <MetricTile label={safeLabel} value={summary?.[safeValueKey] ?? 0} suffix="%" />
    </div>

    <div className="mt-3 space-y-2">
      {predictions.slice(0, 4).map((prediction) => (
        <ScoreRow
          key={prediction.label}
          label={getReadableLabel(prediction, modelName)}
          percent={prediction.percent}
        />
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
      <div className="modal-box flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-base-content/10 bg-base-200/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheckIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold">{resultTitle}</h2>
                <p className="mt-1 truncate text-sm opacity-75">{checkedLabel}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-base-100 px-2.5 py-1 opacity-80">
                    <Clock3Icon className="size-3.5" />
                    {checkedAt ? new Date(checkedAt).toLocaleString() : "Unknown time"}
                  </span>
                  <span className="rounded-full bg-base-100 px-2.5 py-1 opacity-80">
                    {result.cached ? "Saved result" : "Fresh result"}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm opacity-75">{helperText}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onRecheck}
              disabled={isRechecking}
            >
              <RefreshCwIcon className={`size-4 ${isRechecking ? "animate-spin" : ""}`} />
              {isRechecking ? "Rechecking" : "Recheck"}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8 pt-5">
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
              phishingSummary={result.analysis.phishing?.summary || null}
              reputationSummary={result.analysis.reputation}
              extractedLinks={result.extractedLinks}
            />
            <div className="space-y-4">
              <ReputationSummaryCard
                reputationSummary={result.analysis.reputation}
                modelName={result.analysis.models.reputation}
              />
              {(result.analysis?.links || []).map((linkResult) => (
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
