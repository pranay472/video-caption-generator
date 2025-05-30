import uniqid from 'uniqid';
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();
export async function POST(req) {
    const formData = await req.formData();
    const file = formData.get('file');
    const {name, type} = file;
    const data = await file.arrayBuffer();
  
    const s3client = new S3Client({
      region: 'ap-south-1',
      credentials: {
        accessKeyId: process.env.ACCE_KEY,
      secretAccessKey:process.env.SEC_ACCESS_KEY,
      },
    });
  
    const id = uniqid();
    const ext = name.split('.').slice(-1)[0];
    const newName = id + '.' + ext;
  
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Body: data,
      ACL: 'public-read',
      ContentType: type,
      Key: newName,
    });
  
    await s3client.send(uploadCommand);
    return Response.json({name,ext,newName,id});
  }
