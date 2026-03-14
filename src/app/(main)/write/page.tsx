import type { Metadata } from "next";
import { WriteClient } from "./WriteClient";

export const metadata: Metadata = {
  title: "글쓰기",
  description: "카더라 커뮤니티에 새 글을 작성하세요.",
};

export default function WritePage() {
  return <WriteClient />;
}
