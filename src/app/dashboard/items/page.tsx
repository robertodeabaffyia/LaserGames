import { redirect } from "next/navigation";

export default function ItemsPage() {
  redirect("/dashboard/paquetes?tab=items");
}
