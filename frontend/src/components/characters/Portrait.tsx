type Person = "alice" | "bob" | "oscar";

const COPY: Record<Person, { name: string; role: string; index: string; src: string }> = {
  alice: {
    name: "Alice",
    role: "Émettrice",
    index: "01",
    src: "/portraits/alice.jpg",
  },
  bob: {
    name: "Bob",
    role: "Destinataire",
    index: "03",
    src: "/portraits/bob.jpg",
  },
  oscar: {
    name: "Oscar",
    role: "Intercepteur",
    index: "02",
    src: "/portraits/oscar.png",
  },
};

export function Portrait({ person, compact = false }: { person: Person; compact?: boolean }) {
  const data = COPY[person];
  const fit = person === "oscar" ? "object-contain bg-well" : "object-cover object-top";
  return (
    <figure className={compact ? "flex items-center gap-3" : "flex items-center gap-4 md:block md:space-y-2"}>
      <img
        src={data.src}
        alt={`Portrait d’${data.name}`}
        className={
          compact
            ? `h-12 w-12 shrink-0 ${fit}`
            : person === "oscar"
              ? `aspect-square w-16 shrink-0 ${fit} md:w-full md:max-w-[140px]`
              : `aspect-[3/4] w-16 shrink-0 ${fit} md:w-full md:max-w-[140px]`
        }
      />
      <figcaption>
        <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">
          {data.index} / {data.role}
        </p>
        <p className="font-display text-xl leading-none md:text-2xl">{data.name}</p>
      </figcaption>
    </figure>
  );
}
