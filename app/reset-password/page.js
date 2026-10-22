export const dynamic = "force-dynamic";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Set a new password",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
