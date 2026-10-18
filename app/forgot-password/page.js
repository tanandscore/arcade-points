export const dynamic = "force-dynamic";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
