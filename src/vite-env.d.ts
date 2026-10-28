/// <reference types="vite/client" />

interface Window {
  __TAURI_IPC__?: unknown;
  __TAURI_METADATA__?: unknown;
  __TAURI__?: unknown;
}
