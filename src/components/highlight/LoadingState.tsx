import { cn } from "@/lib/helpers";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingStateProps = {
  className?: string;
  message?: string;
  showSkeletons?: boolean;
};

export function LoadingState({
  className,
  message = "Loading...",
  showSkeletons = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center h-full space-y-6 pt-8",
        className
      )}
    >
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-medium text-foreground">{message}</h2>
      </div>

      {showSkeletons && (
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-32 mx-auto" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
