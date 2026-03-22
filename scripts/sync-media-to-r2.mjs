import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import mime from "mime-types";

// 1. 初始化 S3 客户端 (完美适配流水线里的全局环境变量)
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT, // 直接读取 YAML 里的 endpoint
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET;
// 扫描构建后的 dist 目录
const TARGET_DIR = path.resolve(process.cwd(), "dist");

// 定义需要上传的媒体文件后缀 (和 YAML 里的 find 删除命令保持一致)
const MEDIA_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", 
  ".mp4", ".pdf", ".docx", ".zip"
];

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

  // 使用 Promise.all 并发上传。如果文件数量极大（例如过万），建议后续引入 p-limit 控制并发数
  const uploadPromises = files.map(async (filePath) => {
    // 保持相对路径结构（例如：将 dist/assets/image.webp 映射为 R2 中的 assets/image.webp）
    const objectKey = path.relative(TARGET_DIR, filePath).replace(/\\/g, "/");
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || "application/octet-stream";

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

  await Promise.all(uploadPromises);
  console.log("🎉 所有媒体资源已全量兜底同步至 R2！");
}

syncToR2();