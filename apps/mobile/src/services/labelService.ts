import apiClient from "./apiClient";
import type { Label } from "@/types";

export const getLabels = async (): Promise<Label[]> => {
  const response = await apiClient.get<Label[]>("/api/labels");
  return response.data;
};

export const createLabel = async (data: { name: string; color: string }): Promise<Label> => {
  const response = await apiClient.post<Label>("/api/labels", data);
  return response.data;
};

export const updateLabel = async (id: string, data: { name?: string; color?: string }): Promise<Label> => {
  const response = await apiClient.put<Label>(`/api/labels/${id}`, data);
  return response.data;
};

export const deleteLabel = async (id: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/api/labels/${id}`);
  return response.data;
};
