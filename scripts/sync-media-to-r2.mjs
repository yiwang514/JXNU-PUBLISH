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

// MIME 类型映射字典
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
  return mimeMap[ext] || "application/octet-stream";
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

// 3. 执行全量兜底上传任务 (引入并发控制)
async function syncToR2() {
  if (!BUCKET_NAME || !process.env.R2_S3_ENDPOINT) {
    console.error("❌ 环境变量缺失: R2_BUCKET 或 R2_S3_ENDPOINT 未定义");
    process.exit(1);
  }

  // ⚠️ 额外增加一个安全校验，防止运行期间才发现 Bucket 名字不合法
  if (!/^[a-z0-9-]+$/.test(BUCKET_NAME)) {
    console.error(`❌ 致命错误: R2_BUCKET 名字 [${BUCKET_NAME}] 不合法！只能包含小写字母、数字和连字符(-)。`);
    process.exit(1);
  }

  console.log(`🚀 开始扫描 dist 目录，同步静态媒体资源到 R2 Bucket: ${BUCKET_NAME}...`);
  const files = getMediaFiles(TARGET_DIR);

  if (files.length === 0) {
    console.log("⚠️ 没有在 dist 目录找到需要同步的媒体文件，跳过上传。");
    return;
  }

  console.log(`📦 共发现 ${files.length} 个媒体文件，准备上传...`);

  // 🌟 核心修复：并发控制，每次最多同时上传 10 个文件
  const CONCURRENCY_LIMIT = 10;
  
  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`⏳ 正在上传第 ${i + 1} 到 ${Math.min(i + CONCURRENCY_LIMIT, files.length)} 个文件...`);
    
    const uploadPromises = chunk.map(async (filePath) => {
      const objectKey = path.relative(TARGET_DIR, filePath).replace(/\\/g, "/");
      const fileStream = fs.createReadStream(filePath);
      const contentType = getMimeType(filePath);

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: fileStream,
        ContentType: contentType,
      };

      try {
        await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`✅ 上传成功: ${objectKey}`);
      } catch (error) {
        console.error(`❌ 上传失败: ${objectKey}`, error.message);
      }
    });

    // 等待这一批（10个）全部传完，再开始下一批，彻底杜绝 socket hang up
    await Promise.all(uploadPromises);
  }

  console.log("🎉 所有媒体资源已全量兜底同步至 R2！");
}

syncToR2();