"use client";
import axios from "axios";
import UploadIcon from "./UploadIcon";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UploadForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [animeVideoUrl, setAnimeVideoUrl] = useState("");
  const router = useRouter();

  async function handleFileChange(ev) {
    const files = ev.target.files;
    if (files.length > 0) {
      setVideoFile(files[0]);
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
    // Upload to S3 using existing logic
    const uploadRes = await axios.postForm('../api/upload', {
      file: videoFile,
    });
    const s3_key = uploadRes.data.s3_key || uploadRes.data.newName; // adapt as per backend response
    // Call AnimeGAN conversion endpoint (use correct backend URL)
    const animeRes = await axios.post('http://localhost:5001/api/convert', {
      s3_bucket: 'bucket-major-project',
      s3_key: s3_key,
    });
    setIsUploading(false);
    setAnimeVideoUrl(animeRes.data.converted_video_url);
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
      <label className="bg-green-700 py-2 px-6 rounded-full inline-flex gap-2 border-2 border-purple-700/50 cursor-pointer">
        <UploadIcon />
        <span>Choose File</span>
        <input onChange={handleFileChange} type="file" className="hidden" />
      </label>
      <div className="mt-4 flex gap-4">
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded"
          onClick={handleAddSubtitles}
          disabled={!videoFile || isUploading}
        >
          Add Subtitles
        </button>
        <button
          className="bg-purple-600 text-white py-2 px-4 rounded"
          onClick={handleAnimeConvert}
          disabled={!videoFile || isUploading}
        >
          Anime Convert
        </button>
      </div>
      {animeVideoUrl && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-bold">Anime Converted Video:</h3>
          <video src={animeVideoUrl} controls className="w-full max-w-xl" />
        </div>
      )}
    </>
  );
}
