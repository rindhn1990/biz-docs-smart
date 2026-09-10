/** Khối minh hoạ trang tài liệu scan bằng các dòng kẻ ngang. */
export function ScanMock() {
  const lines = [
    "w-2/5 mx-auto",
    "w-1/3 mx-auto",
    "gap",
    "w-1/2 mx-auto",
    "w-1/4 mx-auto",
    "gap",
    "w-full",
    "w-11/12",
    "w-4/5",
    "gap",
    "w-full",
    "w-10/12",
    "w-3/4",
    "gap",
    "w-full",
    "w-2/3",
    "gap",
    "w-11/12",
    "w-1/2",
    "gap",
    "w-5/6",
    "w-3/5",
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      {lines.map((cls, i) => (
        <span
          key={i}
          className={`block h-2 rounded-sm ${cls === "gap" ? "bg-transparent" : `bg-muted ${cls}`}`}
        />
      ))}
    </div>
  );
}
