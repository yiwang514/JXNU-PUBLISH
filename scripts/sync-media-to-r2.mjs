import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";


// 1. 初始化 S3 客户端
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET;
const TARGET_DIR = path.resolve(process.cwd(), "dist");

const MEDIA_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", 
  ".mp4", ".pdf", ".docx", ".zip"
];

// 🌟 新增：手写一个轻量级的 MIME 类型映射字典
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".zip": "application/zip",
  };
  return mimeMap[ext] || "application/octet-stream"; // 匹配不到就用默认二进制流
};

// 2. 递归获取目录下指定的媒体文件
function getMediaFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getMediaFiles(fullPath, arrayOfFiles);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (MEDIA_EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

// 3. 执行全量兜底上传任务
async function syncToR2() {
  if (!BUCKET_NAME || !process.env.R2_S3_ENDPOINT) {
    console.error("❌ 环境变量缺失: R2_BUCKET 或 R2_S3_ENDPOINT 未定义");
    process.exit(1);
  }

  console.log(`🚀 开始扫描 dist 目录，同步静态媒体资源到 R2 Bucket: ${BUCKET_NAME}...`);
  const files = getMediaFiles(TARGET_DIR);

  if (files.length === 0) {
    console.log("⚠️ 没有在 dist 目录找到需要同步的媒体文件，跳过上传。");
    return;
  }

  console.log(`📦 共发现 ${files.length} 个媒体文件，准备上传...`);

  const uploadPromises = files.map(async (filePath) => {
    const objectKey = path.relative(TARGET_DIR, filePath).replace(/\\/g, "/");
    const fileStream = fs.createReadStream(filePath);
    
    // 🌟 使用我们自己写的映射方法
    const contentType = getMimeType(filePath);

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: fileStream,
      ContentType: contentType,
    };

    try {
      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`✅ 上传成功: ${objectKey} (${contentType})`);
    } catch (error) {
      console.error(`❌ 上传失败: ${objectKey}`, error.message);
    }
  });

  await Promise.all(uploadPromises);
  console.log("🎉 所有媒体资源已全量兜底同步至 R2！");
}

syncToR2();