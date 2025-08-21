import { cn } from "@/lib/helpers";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ViewToggleNavProps {
  active: "bubbles" | "highlights";
  onViewChange: (view: "bubbles" | "highlights") => void;
  className?: string;
}

export function ViewToggleNav({
  active,
  onViewChange,
  className,
}: ViewToggleNavProps) {
  const handleViewChange = (value: string) => {
    if (value === "bubbles" || value === "highlights") {
      onViewChange(value);
    }
  };

  return (
    <div
      className={cn(
        "w-full",
        "bg-background/80 backdrop-blur-sm border-b border-border/50",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-center max-w-2xl mx-auto">
        <Tabs value={active} onValueChange={handleViewChange}>
          <TabsList className="bg-muted/80 shadow-inner border border-border/30">
            <TabsTrigger
              value="bubbles"
              className="flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-background/95"
            >
              Bubbles
            </TabsTrigger>
            <TabsTrigger
              value="highlights"
              className="flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-background/95"
            >
              Highlights
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
