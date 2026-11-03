import React, { useEffect, useState } from "react";
import { BUG_REPORT_LIMITS } from "../../bugReport/limits";

/** One attached screenshot; `id` stays stable while others are removed. */
export interface ScreenshotAttachment {
  id: string;
  blob: Blob;
}

const ScreenshotThumbnail: React.FC<{ attachment: ScreenshotAttachment; index: number; onRemove: () => void }> = ({
  attachment,
  index,
  onRemove,
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(attachment.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment.blob]);

  return (
    <li id={`bug-modal-screenshot-${index + 1}`} className="bug-screenshot-thumb">
      {url && <img src={url} alt={`Screenshot ${index + 1}`} />}
      <button
        id={`bug-modal-btn-remove-screenshot-${index + 1}`}
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onRemove}
        aria-label={`Remove screenshot ${index + 1}`}
      >
        Remove
      </button>
    </li>
  );
};

interface ScreenshotStripProps {
  screenshots: readonly ScreenshotAttachment[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  error?: string;
}

/** Attached screenshots as thumbnails, plus the button that opens the annotator. */
export const ScreenshotStrip: React.FC<ScreenshotStripProps> = ({ screenshots, onAdd, onRemove, error }) => {
  const isFull = screenshots.length >= BUG_REPORT_LIMITS.maxScreenshots;
  return (
    <fieldset className="bug-attachment-group" aria-describedby={error ? "bug-modal-screenshot-error" : undefined}>
      <legend>
        Screenshots ({screenshots.length} / {BUG_REPORT_LIMITS.maxScreenshots})
      </legend>
      {screenshots.length > 0 && (
        <ul className="bug-screenshot-strip">
          {screenshots.map((shot, index) => (
            <ScreenshotThumbnail key={shot.id} attachment={shot} index={index} onRemove={() => onRemove(shot.id)} />
          ))}
        </ul>
      )}
      <button
        id="bug-modal-btn-add-screenshot"
        type="button"
        className="btn btn-secondary"
        onClick={onAdd}
        disabled={isFull}
        title={isFull ? `At most ${BUG_REPORT_LIMITS.maxScreenshots} screenshots per report.` : undefined}
      >
        Capture screenshot
      </button>
      {error && (
        <p id="bug-modal-screenshot-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
};

export default ScreenshotStrip;
