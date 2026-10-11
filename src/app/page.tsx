import { redirect } from "next/navigation";

export default function Home() {
  // Временно редиректим на страницу букинга, чтобы легко протестировать UI
  redirect("/booking");
}
