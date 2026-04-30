import { useEffect, useState } from "react";
import { buildFallbackAvatar, getAvatarUrl } from "../lib/avatar";

const AvatarImage = ({ src, name, alt, className, ...props }) => {
  const [imageSrc, setImageSrc] = useState(() => getAvatarUrl(src, name));

  useEffect(() => {
    setImageSrc(getAvatarUrl(src, name));
  }, [src, name]);

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt || name || "Avatar"}
      className={className}
      onError={() => setImageSrc(buildFallbackAvatar(name))}
    />
  );
};

export default AvatarImage;
