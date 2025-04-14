import { NextResponse } from "next/server";
import { convertVideo } from "./convert";

export async function POST(request) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: "No video URL provided" },
        { status: 400 }
      );
    }

    const conversionResult = await convertVideo(videoUrl);
    
    return NextResponse.json(
      { converted_video_url: conversionResult },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}