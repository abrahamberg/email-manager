import { mockApi } from "./api";
import { httpApi } from "./httpApi";
import type { EmailManagerApi } from "./api";

export const api: EmailManagerApi = import.meta.env.VITE_API === "http" ? httpApi : mockApi;
