import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkAuthorizedAccessToken } from "@/app/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "博客后台",
  robots: { index: false, follow: false },
};

/**
 * 后台面板布局：服务端校验登录态（读取 authorized-token cookie 并校验 Supabase token），
 * 未登录或非管理员时跳转登录页。
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("authorized-token")?.value;

  let authorized = false;
  if (raw) {
    try {
      const data = JSON.parse(decodeURIComponent(raw));
      if (data?.accessToken) {
        const user = await checkAuthorizedAccessToken(data.accessToken);
        authorized = Boolean(user?.is_admin);
      }
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
