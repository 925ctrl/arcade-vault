import type { Metadata } from "next";
import { Home } from "@/components/home";

export const metadata: Metadata = {
  title: "Inicio · Arcade Vault",
};

export default function HomePage() {
  return <Home />;
}
