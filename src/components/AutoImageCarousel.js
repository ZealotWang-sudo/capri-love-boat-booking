"use client";

import Image from "next/image";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { useMemo } from "react";

export default function AutoImageCarousel({ images }) {
  const plugins = useMemo(
    () => [
      AutoScroll({
        playOnInit: true,
        speed: 0.8,
        stopOnFocusIn: false,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
      }),
    ],
    [],
  );
  const [emblaRef] = useEmblaCarousel(
    {
      align: "start",
      dragFree: true,
      loop: true,
    },
    plugins,
  );

  return (
    <div
      className="cursor-grab select-none overflow-hidden bg-stone-200 active:cursor-grabbing"
      ref={emblaRef}
    >
      <div className="flex gap-[5px]">
        {images.map((image) => (
          <div
            key={image.src}
            className="relative h-64 w-[70vw] shrink-0 overflow-hidden bg-stone-200 sm:h-80 sm:w-[38vw] lg:h-[360px] lg:w-[20vw]"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 768px) 70vw, (max-width: 1024px) 38vw, 20vw"
              className="pointer-events-none scale-[1.01] object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
