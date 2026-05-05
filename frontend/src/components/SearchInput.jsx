import { SearchIcon, XIcon } from "lucide-react";

const SearchInput = ({
  value,
  onChange,
  placeholder = "Search...",
  maxWidthClassName = "sm:max-w-md lg:max-w-xl",
}) => {
  const hasValue = value.trim().length > 0;

  return (
    <label
      className={`group flex h-12 w-full items-center gap-3 rounded-2xl border px-4 shadow-sm transition-all duration-200 ${maxWidthClassName} ${
        hasValue
          ? "border-primary/35 bg-primary/5 shadow-primary/10"
          : "border-base-content/10 bg-base-100/80 hover:border-base-content/20 hover:bg-base-100"
      } focus-within:border-primary/60 focus-within:bg-base-100 focus-within:shadow-lg focus-within:shadow-primary/10`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl transition-colors ${
          hasValue
            ? "bg-primary text-primary-content"
            : "bg-base-200 text-base-content/60 group-focus-within:bg-primary group-focus-within:text-primary-content"
        }`}
      >
        <SearchIcon className="size-4" />
      </span>
      <input
        type="text"
        className="min-w-0 grow bg-transparent text-sm font-medium outline-none placeholder:text-base-content/45"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {hasValue ? (
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60 hover:bg-base-200 hover:text-base-content"
          onClick={() => onChange("")}
          aria-label="Clear search"
          title="Clear search"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </label>
  );
};

export default SearchInput;
