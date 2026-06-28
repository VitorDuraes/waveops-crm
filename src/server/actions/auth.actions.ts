"use server";
// src/server/actions/auth.actions.ts — entrada de Server Actions de auth (convencao src/server/actions/*).
// Declara funcoes async reais (nao re-export puro), para o Next gerar referencias chamaveis no client.
// A logica canonica vive em src/lib/auth/actions.ts.
import { login as loginImpl, logout as logoutImpl } from "@/lib/auth/actions";
import type { LoginState } from "@/lib/auth/types";

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  return loginImpl(prevState, formData);
}

export async function logout(): Promise<void> {
  return logoutImpl();
}
