import { PipelineEvent } from "../api/types";

/** Column order of the telemetry CSV attached to a bug report. */
export const TELEMETRY_CSV_HEADER = ["timestamp", "status", "source", "message"] as const;

/** RFC 4180 field: quoted when it holds a comma, quote, CR or LF; quotes are doubled. */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Where an event came from: its sidecar origin when known, otherwise its step name. */
function eventSource(event: PipelineEvent): string {
  return event.origin ?? event.step_name;
}

/** Telemetry events as RFC 4180 CSV (CRLF line breaks, header row first). */
export function buildTelemetryCsv(events: readonly PipelineEvent[]): string {
  const rows = [
    TELEMETRY_CSV_HEADER.join(","),
    ...events.map((event) =>
      [event.timestamp, event.status, eventSource(event), event.message].map(escapeCsvField).join(",")
    ),
  ];
  return `${rows.join("\r\n")}\r\n`;
}
