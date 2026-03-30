import apiClient from "./apiClient";

export const createGroup = async (data) => {
  const res = await apiClient.post("/groups", data);

  return res.data;
};
