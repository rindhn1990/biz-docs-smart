import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Keep the selected tab visible without scrolling the containing page. */
export function useActiveTabScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reveal = () => {
      const active = element.querySelector<HTMLElement>('[aria-selected="true"], [data-state="active"], .bg-primary');
      if (!active) return;
      const bounds = element.getBoundingClientRect();
      const tab = active.getBoundingClientRect();
      if (tab.left < bounds.left) element.scrollLeft += tab.left - bounds.left - 4;
      else if (tab.right > bounds.left + element.clientWidth) element.scrollLeft += tab.right - bounds.left - element.clientWidth + 4;
    };
    const observer = new MutationObserver(reveal);
    observer.observe(element, { subtree: true, attributes: true, childList: true, attributeFilter: ["aria-selected", "data-state", "class"] });
    const resize = new ResizeObserver(reveal);
    resize.observe(element);
    reveal();
    return () => { observer.disconnect(); resize.disconnect(); };
  }, []);
  return ref;
}

export function ScrollTabs({ className, ...props }: ComponentProps<"div">) {
  const ref = useActiveTabScroll();
  return <div ref={ref} className={cn("scroll-tabs inline-flex", className)} {...props} />;
}