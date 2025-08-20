import { cn } from "@/utils/utils";

type LoadingStateProps = {
  className?: string;
};

export function LoadingState({ className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center h-64 text-muted-foreground",
        className
      )}
    >
      <div className="text-sm">Checking for saved content...</div>
    </div>
  );
}
