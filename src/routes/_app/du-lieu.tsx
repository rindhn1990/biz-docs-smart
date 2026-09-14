import { createFileRoute, redirect } from "@tanstack/react-router";

/** Trang Dữ liệu đã gộp vào phân hệ Hồ sơ đấu thầu; giữ đường dẫn cũ hoạt động. */
export const Route = createFileRoute("/_app/du-lieu")({
  beforeLoad: () => {
    throw redirect({ to: "/ho-so-dau-thau/du-lieu", search: { doc: undefined } });
  },
  component: () => null,
});
