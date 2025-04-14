import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.ACCE_KEY,
  secretAccessKey: process.env.SEC_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Path to your Flask application
const FLASK_APP_PATH = path.join(process.cwd(), 'backend', 'animegan_api.py');

async function convertVideo(s3Bucket, s3Key) {
  try {
    // Start Flask server in a separate process
    const flaskProcess = exec(`python ${FLASK_APP_PATH}`);

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Make conversion request
    const conversionResponse = await fetch('http://localhost:5001/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ s3_bucket: s3Bucket, s3_key: s3Key }),
    });

    if (!conversionResponse.ok) {
      throw new Error('Conversion failed');
    }

    const data = await conversionResponse.json();
    
    // Stop Flask server
    flaskProcess.kill();

    return data.converted_video_url;
  } catch (error) {
    console.error('Conversion error:', error);
    throw error;
  }
}

export { convertVideo };