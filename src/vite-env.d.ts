/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    __setCurrentTab?: (tab: string) => void;
    __setKaggleActiveTab?: (tab: "download" | "upload" | "metadata" | "notebooks") => void;
  }
}
