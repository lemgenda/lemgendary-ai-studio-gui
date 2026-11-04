import React, { useState } from "react";
import { BugReportResponse } from "../../api/types";
import { copyTextToClipboard } from "../../utils/clipboard";

type CopyTarget = "address" | "subject";

/** Where the report was saved and how to send it. */
export const BugReportSuccess: React.FC<{ result: BugReportResponse }> = ({ result }) => {
  const [copyStatus, setCopyStatus] = useState<string>("");

  const copy = async (target: CopyTarget) => {
    const text = target === "address" ? result.recipient : result.subject;
    const copied = await copyTextToClipboard(text);
    const label = target === "address" ? "Address" : "Subject";
    setCopyStatus(copied ? `${label} copied.` : `Could not copy the ${label.toLowerCase()}; select it and copy it by hand.`);
  };

  return (
    <div id="bug-modal-success" className="bug-success">
      <p>
        The report was saved as <strong>{result.archive_name}</strong>. Attach this file to the email and send it.
      </p>
      <dl className="bug-success-details">
        <dt>Archive</dt>
        <dd id="bug-modal-archive-path">{result.archive_path}</dd>
        <dt>Recipient</dt>
        <dd>
          <span id="bug-modal-recipient">{result.recipient}</span>
          <button id="bug-modal-btn-copy-address" type="button" className="btn btn-secondary btn-sm" onClick={() => void copy("address")}>
            Copy address
          </button>
        </dd>
        <dt>Subject</dt>
        <dd>
          <span id="bug-modal-subject">{result.subject}</span>
          <button id="bug-modal-btn-copy-subject" type="button" className="btn btn-secondary btn-sm" onClick={() => void copy("subject")}>
            Copy subject
          </button>
        </dd>
      </dl>
      {!result.mail_client_opened && (
        <p id="bug-modal-note-mail" className="field-hint">
          Your mail client did not open. Write to the address above with the subject above and attach the archive.
        </p>
      )}
      {!result.folder_revealed && (
        <p id="bug-modal-note-folder" className="field-hint">
          The reports folder did not open. The archive path above is relative to the workspace root.
        </p>
      )}
      <p id="bug-modal-copy-status" role="status" className="field-hint">
        {copyStatus}
      </p>
    </div>
  );
};

export default BugReportSuccess;
