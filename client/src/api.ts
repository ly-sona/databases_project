import axios from "axios";
import { useQuery } from "@tanstack/react-query";

export const api = axios.create({ baseURL: "http://localhost:3000" });

// Add a request interceptor to automatically add the token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const useEndpoint = <T = any>(key: string, url: string) =>
  useQuery<T>({
    queryKey: [key],
    queryFn: () => api.get(url).then((r) => r.data),
  }); 