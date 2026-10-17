import { createAuthClient } from "better-auth/react";

// Sem baseURL: usa a mesma origem do app (/api/auth/*).
export const authClient = createAuthClient();
