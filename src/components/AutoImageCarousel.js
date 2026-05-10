"use client";

import Image from "next/image";
import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const AUTO_SCROLL_SPEED = 22;

function wrapPosition(position, loopWidth) {
  if (!loopWidth) {
    return position;
  }

  if (position <= -loopWidth * 2) {
    return position + loopWidth;
  }

  if (position >= 0) {
    return position - loopWidth;
  }

  return position;
}

export default function AutoImageCarousel({ images }) {
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartPositionRef = useRef(0);
  const dragStartXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const momentumAnimationRef = useRef(null);
  const velocityRef = useRef(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [loopWidth, setLoopWidth] = useState(0);
  const repeatedImages = useMemo(
    () => [...images, ...images, ...images],
    [images],
  );

  useEffect(() => {
    const track = trackRef.current;

    if (!track || images.length === 0) {
      return undefined;
    }

    function measure() {
      const measuredLoopWidth = track.scrollWidth / 3;

      setLoopWidth(measuredLoopWidth);

      if (measuredLoopWidth) {
        x.set(-measuredLoopWidth);
      }
    }

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [images.length, x]);

  useEffect(() => {
    if (!loopWidth) {
      return undefined;
    }

    let previousTime = performance.now();

    function animate(currentTime) {
      const delta = Math.min(currentTime - previousTime, 32);
      previousTime = currentTime;

      if (!isDraggingRef.current) {
        const nextPosition = x.get() - (delta / 1000) * AUTO_SCROLL_SPEED;
        x.set(wrapPosition(nextPosition, loopWidth));
      }

      frameRef.current = window.requestAnimationFrame(animate);
    }

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [loopWidth, x]);

  function handlePointerDown(event) {
    momentumAnimationRef.current?.stop();
    isDraggingRef.current = true;
    dragStartPositionRef.current = x.get();
    dragStartXRef.current = event.clientX;
    lastMoveTimeRef.current = performance.now();
    lastMoveXRef.current = event.clientX;
    velocityRef.current = 0;
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    if (!isDraggingRef.current) {
      return;
    }

    const currentTime = performance.now();
    const timeDelta = Math.max(currentTime - lastMoveTimeRef.current, 1);
    const pointerDelta = event.clientX - lastMoveXRef.current;
    const nextPosition =
      dragStartPositionRef.current + event.clientX - dragStartXRef.current;

    velocityRef.current = pointerDelta / timeDelta;
    lastMoveTimeRef.current = currentTime;
    lastMoveXRef.current = event.clientX;
    x.set(nextPosition);
  }

  function handlePointerUp() {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);

    if (!loopWidth) {
      return;
    }

    const momentumTarget = x.get() + velocityRef.current * 420;

    momentumAnimationRef.current = animate(x, momentumTarget, {
      bounceStiffness: 0,
      onUpdate: (latestPosition) => {
        x.set(wrapPosition(latestPosition, loopWidth));
      },
      power: 0.55,
      timeConstant: 520,
      type: "inertia",
    });
  }

  return (
    <div
      className={[
        "overflow-hidden select-none bg-stone-200",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      ].join(" ")}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "pan-y" }}
    >
      <motion.div
        ref={trackRef}
        className="flex"
        style={{ x }}
      >
        {repeatedImages.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            className="relative -mr-px h-64 w-[calc(70vw+1px)] shrink-0 overflow-hidden bg-stone-200 sm:h-80 sm:w-[calc(38vw+1px)] lg:h-[360px] lg:w-[calc(20vw+1px)]"
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
      </motion.div>
    </div>
  );
}
