import { Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AffinityBoardToolbarProps {
  onAddSection: () => void;
  onAddTheme: () => void;
  onAddNote: () => void;
  onManageTags: () => void;
}

export function AffinityBoardToolbar({ onAddSection, onAddTheme, onAddNote, onManageTags }: AffinityBoardToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddSection}>
        <Plus className="h-3.5 w-3.5" />
        Section
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddTheme}>
        <Plus className="h-3.5 w-3.5" />
        Theme
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddNote}>
        <Plus className="h-3.5 w-3.5" />
        Note
      </Button>
      <div className="ml-auto">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onManageTags}>
          <Tags className="h-3.5 w-3.5" />
          Manage Tags
        </Button>
      </div>
    </div>
  );
}
