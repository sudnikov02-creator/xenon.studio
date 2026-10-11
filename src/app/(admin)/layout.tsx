import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { AUTH_COOKIE, readToken } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!readToken(token)) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/10">{children}</main>
    </div>
  );
}
