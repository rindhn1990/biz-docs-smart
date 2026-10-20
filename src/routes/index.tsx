import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "OfficeFlow — Quản lý văn phòng doanh nghiệp" },
    { name: "description", content: "Quản lý hồ sơ, đấu thầu và hợp đồng nhân sự trong OfficeFlow." },
    { property: "og:title", content: "OfficeFlow — Quản lý văn phòng doanh nghiệp" },
    { property: "og:description", content: "Không gian quản lý hồ sơ và hợp đồng doanh nghiệp." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/tong-quan" });
  },
  component: () => null,
});
