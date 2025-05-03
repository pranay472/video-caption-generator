from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import cv2
import numpy as np
import onnxruntime as ort
from tqdm import tqdm
import tempfile
import boto3
import botocore
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configurations
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size

# AWS credentials
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.environ.get('AWS_REGION')

# Print credentials if they exist
if AWS_ACCESS_KEY_ID:
    print(f"AWS_ACCESS_KEY_ID: {AWS_ACCESS_KEY_ID}")
if AWS_SECRET_ACCESS_KEY:
    print(f"AWS_SECRET_ACCESS_KEY: {AWS_SECRET_ACCESS_KEY}")
if AWS_REGION:
    print(f"AWS_REGION: {AWS_REGION}")

if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION]):
    raise ValueError("AWS credentials not properly configured in environment variables")

s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Paprika_54.onnx')
session = ort.InferenceSession(model_path)

def post_process(img, wh):
    img = (img.squeeze() + 1.) / 2 * 255
    img = img.astype(np.uint8).clip(0, 255)
    img = cv2.resize(img, (wh[0], wh[1]))
    return img

def process_image(img):
    h, w = img.shape[:2]
    img = cv2.resize(img, (w - w % 32, h - h % 32))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 127.5 - 1.0
    return img

def convert_video(s3_bucket, s3_key):
    try:
        # Download video from S3
        input_path = tempfile.mktemp(suffix='.mp4')
        output_path = tempfile.mktemp(suffix='_AnimeGANv2.mp4')

        # Ensure we have read permissions
        s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
        
        with open(input_path, 'wb') as f:
            s3_client.download_fileobj(s3_bucket, s3_key, f)

        # Process video
        vid = cv2.VideoCapture(input_path)
        total = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = vid.get(cv2.CAP_PROP_FPS)
        width = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))

        codec = cv2.VideoWriter_fourcc(*'mp4v')
        video_out = cv2.VideoWriter(output_path, codec, fps, (width, height))

        pbar = tqdm(total=total, desc="Converting video to anime style")
        while True:
            ret, frame = vid.read()
            if not ret:
                break
            frame = np.asarray(np.expand_dims(process_image(frame), 0))
            x = session.get_inputs()[0].name
            fake_img = session.run(None, {x: frame})[0]
            fake_img = post_process(fake_img, (width, height))
            video_out.write(cv2.cvtColor(fake_img, cv2.COLOR_BGR2RGB))
            pbar.update(1)

        pbar.close()
        vid.release()
        video_out.release()

        # --- Fix MP4 for browser streaming and re-encode to H.264 ---
        import subprocess
        fixed_output_path = output_path.replace('.mp4', '_fixed.mp4')
        subprocess.run([
            'ffmpeg', '-y', '-i', output_path,
            '-movflags', 'faststart',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
            fixed_output_path
        ])

        # Upload converted video back to S3 with public read permissions
        output_key = f"anime_converted/{s3_key}"
        s3_client.upload_file(
            fixed_output_path,
            s3_bucket,
            output_key,
            ExtraArgs={
                'ACL': 'public-read',
                'ContentType': 'video/mp4'
            }
        )

        # Get the public URL for the converted video
        converted_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket,
                'Key': output_key,
                'ResponseContentType': 'video/mp4',
                'ResponseContentDisposition': 'inline'
            },
            ExpiresIn=86400,  # URL valid for 24 hours
            # region_name='ap-south-1'  # Mumbai region
        )

        # Clean up temporary files
        os.remove(input_path)
        os.remove(output_path)
        os.remove(fixed_output_path)

        return converted_url

    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'AccessDenied':
            raise Exception("Access denied to S3 bucket. Please check your AWS credentials and bucket permissions.")
        raise Exception(f"S3 operation failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Video conversion failed: {str(e)}")

@app.route('/api/convert', methods=['POST'])
def convert_video_api():
    try:
        data = request.json
        s3_bucket = data.get('s3_bucket')
        s3_key = data.get('s3_key')
        output_key = f"anime_converted/{s3_key}"
        lock_key = f"anime_converted/{s3_key}.lock"
        # Check if already converted
        try:
            s3_client.head_object(Bucket=s3_bucket, Key=output_key)
            converted_url = f'https://{s3_bucket}.s3.amazonaws.com/{output_key}'
            return jsonify({"converted_video_url": converted_url}), 200
        except botocore.exceptions.ClientError as e:
            error_code = int(e.response.get('Error', {}).get('Code', 0))
            if error_code != 404:
                return jsonify({"error": f"S3 check failed: {str(e)}"}), 500
        # Check for lock
        try:
            s3_client.head_object(Bucket=s3_bucket, Key=lock_key)
            # Lock exists, conversion in progress
            return jsonify({"status": "processing"}), 202
        except botocore.exceptions.ClientError as e:
            error_code = int(e.response.get('Error', {}).get('Code', 0))
            if error_code != 404:
                return jsonify({"error": f"S3 lock check failed: {str(e)}"}), 500
        # No lock, create lock and start conversion
        s3_client.put_object(Bucket=s3_bucket, Key=lock_key, Body=b'')
        try:
            converted_url = convert_video(s3_bucket, s3_key)
        finally:
            s3_client.delete_object(Bucket=s3_bucket, Key=lock_key)
        print(f"Converted video URL: {converted_url}")
        return jsonify({"converted_video_url": converted_url}), 200
    except botocore.exceptions.ClientError as e:
        return jsonify({"error": f"S3 operation failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Video conversion failed: {str(e)}"}), 500

@app.route('/api/animegan/convert', methods=['POST'])
def animegan_convert_api():
    try:
        data = request.json
        # Use default bucket if not provided
        s3_bucket = data.get('s3_bucket') or os.environ.get('S3_BUCKET')
        s3_key = data.get('s3_key')
        if not s3_bucket or not s3_key:
            return jsonify({"error": "Missing S3 bucket or key"}), 400
        converted_url = convert_video(s3_bucket, s3_key)
        print(f"AnimeGAN converted video URL: {converted_url}")
        return jsonify({"anime_s3_url": converted_url}), 200
    except botocore.exceptions.ClientError as e:
        return jsonify({"error": f"S3 operation failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"AnimeGAN video conversion failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(port=5001)
