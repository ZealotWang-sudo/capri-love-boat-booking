"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export default function MeetUpPhotoGallery({ labels, photos }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const normalizedPhotos = photos.map((photo) =>
    typeof photo === "string" ? { src: photo } : photo,
  );
  const activePhoto = activeIndex === null ? null : normalizedPhotos[activeIndex];

  const closeModal = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const showNextPhoto = useCallback(() => {
    setActiveIndex((currentIndex) =>
      currentIndex === null ? 0 : (currentIndex + 1) % photos.length,
    );
  }, [photos.length]);

  const showPreviousPhoto = useCallback(() => {
    setActiveIndex((currentIndex) =>
      currentIndex === null
        ? 0
        : (currentIndex - 1 + photos.length) % photos.length,
    );
  }, [photos.length]);

  useEffect(() => {
    if (activeIndex === null) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeModal();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, closeModal, showNextPhoto, showPreviousPhoto]);

  return (
    <div className="border-t border-stone-300 pt-4">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {labels.title}
      </p>
      {labels.hint ? (
        <p className="mt-2 text-sm leading-6 text-stone-600">{labels.hint}</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {normalizedPhotos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative aspect-[4/3] overflow-hidden border border-stone-300 bg-stone-200 text-left"
            aria-label={`${labels.open} ${index + 1}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt ?? `${labels.photoAlt} ${index + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 180px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            {photo.label ? (
              <span className="absolute inset-x-0 bottom-0 bg-stone-950/70 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#f3eee7]">
                {photo.label}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={labels.title}
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col bg-[#fbf8f3] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-stone-300 pb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {activeIndex + 1} / {normalizedPhotos.length}
                {activePhoto.label ? ` · ${activePhoto.label}` : ""}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                {labels.close}
              </button>
            </div>

            <div className="relative mt-4 h-[68vh] min-h-80 bg-stone-200">
              <Image
                src={activePhoto.src}
                alt={activePhoto.alt ?? `${labels.photoAlt} ${activeIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="border border-stone-950 px-4 py-3 text-xs uppercase tracking-[0.16em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
              >
                {labels.previous}
              </button>
              <button
                type="button"
                onClick={showNextPhoto}
                className="border border-stone-950 px-4 py-3 text-xs uppercase tracking-[0.16em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
              >
                {labels.next}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
