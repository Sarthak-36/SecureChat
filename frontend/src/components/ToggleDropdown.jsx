import { useEffect, useRef, useState } from "react";

const ToggleDropdown = ({
  align = "left",
  containerClassName = "",
  contentClassName = "",
  renderTrigger,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((currentValue) => !currentValue);
  const alignmentClassName = align === "right" ? "right-0" : "left-0";

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      {renderTrigger({ close, isOpen, toggle })}
      {isOpen ? (
        <div className={`absolute ${alignmentClassName} z-20 mt-2 ${contentClassName}`}>
          {typeof children === "function" ? children({ close }) : children}
        </div>
      ) : null}
    </div>
  );
};

export default ToggleDropdown;
