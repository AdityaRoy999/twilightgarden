import { AppIcon } from "../../components/ui/Icons";
export const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export const date = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const duration = (s: number) =>
  `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
export const icon = (name: string, size = 20) => (
  <AppIcon name={name} size={size} />
);
export const external = { target: "_blank", rel: "noopener noreferrer" };
