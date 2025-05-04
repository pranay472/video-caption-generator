"use client";
export const dynamic = "force-dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function AnimeResultPage() {
  const searchParams = useSearchParams();
  const originalUrl = searchParams.get("original");
  const animeUrlParam = searchParams.get("anime");
  const s3Key = searchParams.get("s3_key");
  const [originalVideoUrl, setOriginalVideoUrl] = useState("");
  const [animeVideoUrl, setAnimeVideoUrl] = useState(animeUrlParam || "");
  const [isConverting, setIsConverting] = useState(!!s3Key && !animeUrlParam);
  const [progressMsg, setProgressMsg] = useState("Converting to Anime...");
  const router = useRouter();

  useEffect(() => {
    if (originalUrl) setOriginalVideoUrl(originalUrl);
  }, [originalUrl]);

  const requestInProgress = useRef(false);

  useEffect(() => {
    let interval;
    async function pollConversion() {
      if (!s3Key || animeVideoUrl || requestInProgress.current) return;
      requestInProgress.current = true;
      try {
        const res = await axios.post("http://localhost:5001/api/convert", {
          s3_bucket: "bucket-major-project",
          s3_key: s3Key,
        });
        if (res.data.converted_video_url) {
          setAnimeVideoUrl(res.data.converted_video_url);
          setIsConverting(false);
          const newSearch = `?original=${encodeURIComponent(originalUrl)}&anime=${encodeURIComponent(res.data.converted_video_url)}`;
          router.replace(`/anime-result${newSearch}`);
        } else if (res.data.status === "processing") {
          setProgressMsg("Still converting... (will auto-refresh)");
        }
      } catch (err) {
        setProgressMsg("Still converting... (will auto-refresh)");
      } finally {
        requestInProgress.current = false;
      }
    }
    if (isConverting) {
      interval = setInterval(pollConversion, 4000);
      pollConversion(); // fire immediately
    }
    return () => interval && clearInterval(interval);
  }, [s3Key, animeVideoUrl, isConverting, originalUrl, router]);

  if (!originalVideoUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-xl text-gray-500">Loading result...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mt-10">
      <h3 className="mb-4 text-lg font-bold">Anime Conversion Result</h3>
      <div className="flex flex-row justify-center items-center gap-8 w-full max-w-5xl">
        {/* Original Video */}
        <div className="bg-gray-800/50 rounded-xl flex flex-col items-center p-2 w-full max-w-[400px] max-h-[480px]">
          <span className="mb-2 text-sm text-white">Original</span>
          <video
            src={originalVideoUrl}
            controls
            className="w-full h-full object-contain rounded"
            style={{ background: "#222", maxWidth: '100%', maxHeight: '400px' }}
          />
        </div>
        {/* Symbol */}
        <div className="hidden sm:block">
          <span className="text-4xl">→</span>
        </div>
        {/* Anime Converted Video or Progress */}
        <div className="bg-gray-800/50 rounded-xl flex flex-col items-center p-2 w-full max-w-[400px] max-h-[480px] min-h-[420px] min-w-[200px] justify-center">
          <span className="mb-2 text-sm text-white">Anime</span>
          {isConverting || !animeVideoUrl ? (
            <div className="flex flex-col items-center justify-center h-full w-full">
              <svg className="animate-spin h-12 w-12 text-purple-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span className="text-purple-300 text-lg">{progressMsg}</span>
            </div>
          ) : (
            <video
              src={animeVideoUrl}
              controls
              className="w-full h-full object-contain rounded"
              style={{ background: "#222", maxWidth: '100%', maxHeight: '400px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
