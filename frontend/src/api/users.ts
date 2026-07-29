import { apiClient } from "./client";
import { User } from "../types/domain";

export const usersApi = {
  list: () => apiClient.get<User[]>("/users"),
  create: (input: { display_name: string }) => apiClient.post<User>("/users", input),
};
