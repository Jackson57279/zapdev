import React from "react";

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

const Image = React.forwardRef<HTMLImageElement, ImageProps>(function NextCompatImage(
  { src, alt, width, height, fill, style, ...rest },
  ref
) {
  const resolvedStyle = fill
    ? { objectFit: "cover", width: "100%", height: "100%", ...style }
    : style;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={resolvedStyle}
      loading={rest.loading ?? (rest.priority ? "eager" : "lazy")}
      {...rest}
    />
  );
});

export default Image;
export type { ImageProps };
