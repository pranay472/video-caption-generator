"use client";
import axios from "axios";
import UploadIcon from "./UploadIcon";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UploadForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [animeVideoUrl, setAnimeVideoUrl] = useState("");
  const [originalVideoUrl, setOriginalVideoUrl] = useState("");
  const router = useRouter();

  async function handleFileChange(ev) {
    const files = ev.target.files;
    if (files.length > 0) {
      setVideoFile(files[0]);
      setOriginalVideoUrl(URL.createObjectURL(files[0]));
    }
  }

  async function handleAddSubtitles() {
    if (!videoFile) return;
    setIsUploading(true);
    const res = await axios.postForm('../api/upload', {
      file: videoFile,
    });
    setIsUploading(false);
    const newName = res.data.newName;
    router.push("/" + newName);
  }

  async function handleAnimeConvert() {
    if (!videoFile) return;
    setIsUploading(true);
    const uploadRes = await axios.postForm('../api/upload', {
      file: videoFile,
    });
    const s3_key = uploadRes.data.s3_key || uploadRes.data.newName;
    setIsUploading(false);
    const origUrl = encodeURIComponent(originalVideoUrl);
    const s3KeyParam = encodeURIComponent(s3_key);
    // Redirect immediately after upload, conversion will happen on result page
    router.push(`/anime-result?original=${origUrl}&s3_key=${s3KeyParam}`);
  }

  return (
    <>
      {isUploading && (
        <div className="bg-black/80 text-white fixed inset-0 flex items-center">
          <div className="w-full text-center">
            <h2 className="text-4xl mb-4">Uploading</h2>
            <h3 className="text-xl">Please wait...</h3>
          </div>
        </div>
      )}
      <label className="bg-gray-100 border border-gray-300 text-gray-800 py-2 px-6 rounded-full inline-flex gap-2 cursor-pointer shadow-sm font-medium text-base hover:bg-gray-200 transition-colors duration-200">
        <UploadIcon />
        <span>{videoFile ? videoFile.name : "Choose Video File"}</span>
        <input onChange={handleFileChange} type="file" className="hidden" />
      </label>
      <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center items-center">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded shadow-sm font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
          onClick={handleAddSubtitles}
          disabled={!videoFile || isUploading}
        >
          Generate Captions
        </button>
        <button
          className="bg-purple-700 hover:bg-purple-800 text-white py-2 px-5 rounded shadow-sm font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-400"
          onClick={handleAnimeConvert}
          disabled={!videoFile || isUploading}
        >
          Convert to Anime Style
        </button>
      </div>
      {animeVideoUrl && (
        <div className="mt-6 flex flex-col items-center">
          <h3 className="mb-4 text-lg font-bold">Anime Conversion Result</h3>
          <div className="flex flex-row justify-center items-center gap-8">
            {/* Original Video */}
            <div className="bg-gray-800/50 rounded-xl flex flex-col items-center p-2">
              <span className="mb-2 text-sm text-white">Original</span>
              <video
                src={originalVideoUrl}
                controls
                className="w-[240px] h-[480px] object-contain rounded"
                style={{background: '#222'}}
              />
            </div>
            {/* Symbol (SparklesIcon or similar) */}
            <div className="hidden sm:block">
              <span className="text-4xl">→</span>
            </div>
            {/* Anime Converted Video */}
            <div className="bg-gray-800/50 rounded-xl flex flex-col items-center p-2">
              <span className="mb-2 text-sm text-white">Anime</span>
              <video
                src={animeVideoUrl}
                controls
                className="w-[240px] h-[480px] object-contain rounded"
                style={{background: '#222'}}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
