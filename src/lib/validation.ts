import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe o endereço de email.")
  .email("Informe um email válido.");

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .regex(/[a-zA-Z]/, "A senha deve conter pelo menos uma letra.")
  .regex(/[0-9]/, "A senha deve conter pelo menos um número.");

export interface PasswordStrengthResult {
  score: number; // 0 a 4
  label: "Muito fraca" | "Fraca" | "Média" | "Forte" | "Muito forte";
  color: string;
}

export function passwordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, label: "Muito fraca", color: "bg-muted" };
  }

  let points = 0;

  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/[0-9]/.test(password)) points += 1;
  if (/[^a-zA-Z0-9]/.test(password)) points += 1;

  let score = 0;
  if (points <= 1) score = 0;
  else if (points === 2) score = 1;
  else if (points === 3) score = 2;
  else if (points === 4) score = 3;
  else score = 4;

  const labels: PasswordStrengthResult["label"][] = [
    "Muito fraca",
    "Fraca",
    "Média",
    "Forte",
    "Muito forte",
  ];

  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-green-600",
  ];

  return {
    score,
    label: labels[score],
    color: colors[score],
  };
}
