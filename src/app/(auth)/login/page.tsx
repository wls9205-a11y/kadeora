import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "로그인",
  description: "카더라에 로그인하세요.",
};

export default function LoginPage() {
  return <LoginClient />;
}
