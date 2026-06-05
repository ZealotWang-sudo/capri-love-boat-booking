"use client";

import Image from "next/image";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

const CAROUSEL_FRAME_CLASSES = [
  "h-40 w-56 sm:h-44 sm:w-72 lg:h-44 lg:w-80",
  "h-48 w-44 sm:h-56 sm:w-52 lg:h-64 lg:w-60",
  "h-36 w-60 sm:h-48 sm:w-80 lg:h-52 lg:w-96",
  "h-56 w-48 sm:h-72 sm:w-60 lg:h-80 lg:w-72",
  "h-40 w-52 sm:h-44 sm:w-64 lg:h-48 lg:w-72",
  "h-52 w-52 sm:h-64 sm:w-64 lg:h-72 lg:w-72",
];

export default function AutoImageCarousel({ images }) {
  const viewportRef = useRef(null);
  const slideRefs = useRef([]);
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
      watchFocus: false,
    },
    plugins,
  );
  const setViewportRef = useCallback(
    (node) => {
      viewportRef.current = node;
      emblaRef(node);
    },
    [emblaRef],
  );

  useEffect(() => {
    let frameId;

    function updateSlideOpacity() {
      const viewport = viewportRef.current;

      if (!viewport) {
        frameId = window.requestAnimationFrame(updateSlideOpacity);
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();

      slideRefs.current.forEach((slide) => {
        if (!slide) {
          return;
        }

        const slideRect = slide.getBoundingClientRect();
        const isClipped =
          slideRect.left < viewportRect.left || slideRect.right > viewportRect.right;

        slide.style.opacity = isClipped ? "0.35" : "1";
      });

      frameId = window.requestAnimationFrame(updateSlideOpacity);
    }

    frameId = window.requestAnimationFrame(updateSlideOpacity);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div
      className="relative cursor-grab select-none overflow-hidden bg-[#f3eee7] py-10 active:cursor-grabbing sm:py-14"
      ref={setViewportRef}
    >
      <div className="flex min-h-64 items-center sm:min-h-80 lg:min-h-[23rem]">
        {images.map((image, index) => (
          <div
            key={image.src}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
            className="min-w-0 basis-auto shrink-0 px-4 opacity-100 transition-opacity duration-300 sm:px-6"
          >
            <div
              className={`relative overflow-hidden bg-stone-200 shadow-sm ${CAROUSEL_FRAME_CLASSES[index % CAROUSEL_FRAME_CLASSES.length]}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 70vw, (max-width: 1024px) 40vw, 24rem"
                className="pointer-events-none scale-[1.01] object-cover"
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
