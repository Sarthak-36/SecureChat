const AvatarImage = ({ src, name, alt, className, ...props }) => (
  <img {...props} src={src} alt={alt || name || "Avatar"} className={className} />
);

export default AvatarImage;
