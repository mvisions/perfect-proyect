export const API_BASE = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
  ? "http://127.0.0.1:8081"
  : "https://estudionoe-api.onrender.com";
