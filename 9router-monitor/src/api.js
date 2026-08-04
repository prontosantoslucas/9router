import { invoke } from "@tauri-apps/api/core";

export const login = (baseUrl, password) =>
  invoke("login", { baseUrl, password });

export const logout = () => invoke("logout");

export const setBaseUrl = (baseUrl) => invoke("set_base_url", { baseUrl });

export const setAlwaysOnTop = (value) =>
  invoke("set_always_on_top", { value });

export const openOAuthWindow = () => invoke("open_oauth_window");

export const apiGet = (path) => invoke("api_get", { path });

export const getProviders = () => apiGet("/api/providers");
export const getStats = (period) => apiGet(`/api/usage/stats?period=${period}`);
export const getChart = (period) => apiGet(`/api/usage/chart?period=${period}`);
export const getQuota = (connectionId) => apiGet(`/api/usage/${connectionId}`);
export const getRequestDetails = (params = "") =>
  apiGet(`/api/usage/request-details${params ? `?${params}` : ""}`);
