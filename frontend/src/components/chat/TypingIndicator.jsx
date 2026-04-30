const TypingIndicator = ({ name }) => (
  <div className="px-2 py-1 text-sm opacity-70">
    {name || "Someone"} is typing<span className="loading loading-dots loading-xs ml-1 align-middle" />
  </div>
);

export default TypingIndicator;
