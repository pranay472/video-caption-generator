import { useEffect, useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { transcriptionItemsToSrt } from "@/libs/awsTranscriptionHelpers";
import SparklesIcon from "./SparklesIcon";
import roboto from "../fonts/Roboto-Regular.ttf";
import noto from "../fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf"
export default function ResultVideo({ filename, transcriptionItems }) {
  const videoUrl = "https://pranay-video-scribe.s3.amazonaws.com/" + filename;
  const [loaded, setLoaded] = useState(false);
  const [primaryColour, setPrimaryColour] = useState("#FFFFFF");
  const [outlineColour, setOutlineColour] = useState("#000000");
  const [progress, setProgress] = useState(1);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current.src = videoUrl;
    load();
  }, []);

  const load = async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    await ffmpeg.writeFile("./tmp/roboto.ttf", await fetchFile(roboto));
    await ffmpeg.writeFile("./tmp/noto.ttf", await fetchFile(noto));
    setLoaded(true);
  };


  const transcode = async () => {
    const ffmpeg = ffmpegRef.current;
    const srt = transcriptionItemsToSrt(transcriptionItems);
    await ffmpeg.writeFile(filename, await fetchFile(videoUrl));
    await ffmpeg.writeFile("subs.srt", srt); // Encode srt as UTF-8
    videoRef.current.src = videoUrl;
    await new Promise((resolve, reject) => {
      videoRef.current.onloadedmetadata = resolve;
    });
    const duration = videoRef.current.duration;
    console.log({duration});
    ffmpeg.on('log', ({ message }) => {
      const regexResult = /time=([0-9:.]+)/.exec(message);
      if (regexResult && regexResult?.[1]) {
        const howMuchIsDone = regexResult?.[1];
        console.log({howMuchIsDone});
        const [hours,minutes,seconds] = howMuchIsDone.split(':');
        const doneTotalSeconds = hours * 3600 + minutes * 60 + seconds;
        const videoProgress = doneTotalSeconds / duration;
        setProgress(videoProgress);
      }
    });
    await ffmpeg.exec([
        "-i",
        filename,
        "-preset",
        "ultrafast",
        "-to",
        "00:00:10",
        "-vf",
        `subtitles=subs.srt:fontsdir=./tmp:force_style='Fontname=Noto Sans,
          FontSize=30,
          MarginV=-100'`,
        "output.mp4",
      ]);
    const data = await ffmpeg.readFile("output.mp4");
    videoRef.current.src = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );
    setProgress(1);
  };

  return (
    <>
      <div className="mb-4">
        <button
          onClick={transcode}
          className="bg-green-700 py-2 px-6 rounded-full inline-flex gap-2 border-2 border-purple-700/50 cursor-pointer"
        >
          <SparklesIcon />
          <span>Insert Captions</span>
        </button>
      </div>
      <div className="rounded-xl overflow-hidden relative">
         {progress && progress < 1 && (
          <div className="absolute inset-0 bg-black/80 flex items-center">
            <div className="w-full text-center">
              <div className="bg-bg-gradient-from/60 mx-8 rounded-lg overflow-hidden relative">
                <div className="bg-bg-gradient-from h-8"
                     style={{width:progress * 100+'%'}}>
                  <h3 className="text-white text-xl absolute inset-0 py-1">
                    {parseInt(progress * 100)}%
                  </h3>
                </div>
              </div>
            </div>
          </div>
        )}
        <video data-video={0} ref={videoRef} controls></video>
      </div>
    </>
  );
}
