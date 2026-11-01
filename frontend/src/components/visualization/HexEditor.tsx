import { setByte, splitBytes } from "../../lib/hex";

export function HexEditor({
  hex,
  original,
  onChange,
  disabled,
  selected,
  onSelect,
}: {
  hex: string;
  original?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  selected?: number | null;
  onSelect?: (index: number) => void;
}) {
  const bytes = splitBytes(hex);
  const origin = original ? splitBytes(original) : [];
  return (
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-8 lg:grid-cols-[repeat(16,minmax(0,1fr))]">
      {bytes.map((byte, index) => {
        const dirty = origin[index] !== undefined && origin[index] !== byte;
        const active = selected === index;
        return (
          <label key={`${index}-${byte}`} className="block">
            <span className="sr-only">Octet {index}</span>
            <input
              value={byte}
              disabled={disabled}
              maxLength={2}
              onFocus={() => onSelect?.(index)}
              onClick={() => onSelect?.(index)}
              onChange={(event) => onChange(setByte(hex, index, event.target.value))}
              className={`min-h-11 w-full border bg-well px-0 py-2 text-center font-mono text-base uppercase outline-none md:min-h-0 md:py-1 md:text-[11px] ${
                active
                  ? "border-[#c4a36a] text-[#f0d7b8]"
                  : dirty
                    ? "border-[#c4a36a]/70 text-[#f0d7b8]"
                    : "border-white/10 text-well-ink"
              }`}
            />
          </label>
        );
      })}
    </div>
  );
}
