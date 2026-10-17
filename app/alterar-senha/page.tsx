import ResetPasswordForm from "@/components/ResetPasswordForm";

// O link do e-mail (convite ou recuperação) passa por /api/auth/reset-password,
// que redireciona para cá com ?token=… (válido) ou ?error=INVALID_TOKEN.
export default async function AlterarSenha({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return <ResetPasswordForm token={error ? null : token ?? null} />;
}
