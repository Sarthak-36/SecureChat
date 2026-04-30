import { SearchIcon } from "lucide-react";

const SearchInput = ({ value, onChange, placeholder = "Search..." }) => {
  return (
    <label className="input input-bordered flex items-center gap-2 w-full sm:max-w-sm">
      <SearchIcon className="size-4 opacity-60" />
      <input
        type="text"
        className="grow"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
};

export default SearchInput;
