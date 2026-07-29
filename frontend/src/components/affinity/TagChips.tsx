import { Tag } from "../../types/domain";

export function TagChips({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4"
          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
