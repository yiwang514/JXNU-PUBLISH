import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

// 🌟 改进 2：只指定要上传的目录名称，不再限制文件扩展名
const TARGET_FOLDERS = ["attachments", "covers", "img"];

// 轻量级 MIME 字典 (匹配不到的全部默认当做二进制流上传)
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".mp4": "video/mp4", ".pdf": "application/pdf", ".zip": "application/zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword", ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeMap[ext] || "application/octet-stream"; 
};

// 递归获取指定文件夹下的【所有】文件
function getAllFilesInDir(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFilesInDir(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath); // 不管什么后缀，只要在目标文件夹里就抓取
    }
  });
  return arrayOfFiles;
}

// 🌟 改进 1：获取 R2 中已存在的文件列表 (支持分页处理超大存储桶)
async function getExistingR2Objects(bucketName) {
  const existingObjects = new Map(); // 存储格式: key -> size
  let isTruncated = true;
  let continuationToken = undefined;

  console.log(`🔍 正在从 R2 获取已存在的文件列表，用于增量对比...`);
  
  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });
    try {
      const response = await s3Client.send(command);
      if (response.Contents) {
        response.Contents.forEach((item) => {
          existingObjects.set(item.Key, item.Size);
        });
      }
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    } catch (error) {
      console.error("❌ 获取 R2 文件列表失败，请检查密钥或 Bucket 名称:", error.message);
      process.exit(1);
    }
  }
  return existingObjects;
}

// 3. 执行【增量】与【并发】上传任务
async function syncToR2() {
  if (!BUCKET_NAME || !process.env.R2_S3_ENDPOINT) {
    console.error("❌ 环境变量缺失: R2_BUCKET 或 R2_S3_ENDPOINT 未定义");
    process.exit(1);
  }

  // 1. 收集本地目标文件夹中的所有文件
  let localFiles = [];
  TARGET_FOLDERS.forEach(folder => {
    const folderPath = path.join(TARGET_DIR, folder);
    localFiles = localFiles.concat(getAllFilesInDir(folderPath));
  });

  if (localFiles.length === 0) {
    console.log("⚠️ 在 dist 中未找到 attachments, covers 或 img 文件夹，或文件夹为空，跳过上传。");
    return;
  }

  // 2. 获取线上 R2 状态进行对比
  const existingR2Objects = await getExistingR2Objects(BUCKET_NAME);
  console.log(`📊 R2 存储桶中当前共有 ${existingR2Objects.size} 个文件。`);

  // 3. 筛选出真正需要上传的文件（R2中没有，或者文件大小发生了变化）
  const filesToUpload = localFiles.filter(filePath => {
    const objectKey = path.relative(TARGET_DIR, filePath).replace(/\\/g, "/");
    const localSize = fs.statSync(filePath).size;
    
    if (!existingR2Objects.has(objectKey)) return true; // 线上没有，传！
    if (existingR2Objects.get(objectKey) !== localSize) return true; // 大小变了（文件被覆盖修改过），传！
    return false; // 完全一样，跳过
  });

  if (filesToUpload.length === 0) {
    console.log("✅ 所有本地文件在 R2 中均已存在且大小一致，无需上传！");
    return;
  }

  console.log(`📦 经过对比，本次需增量上传 ${filesToUpload.length} 个文件...`);

  // 4. 并发控制上传（每次 10 个）
  const CONCURRENCY_LIMIT = 10;
  for (let i = 0; i < filesToUpload.length; i += CONCURRENCY_LIMIT) {
    const chunk = filesToUpload.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`⏳ 正在上传第 ${i + 1} 到 ${Math.min(i + CONCURRENCY_LIMIT, filesToUpload.length)} 个文件...`);
    
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

    await Promise.all(uploadPromises);
  }

  console.log("🎉 本次增量同步 R2 任务圆满完成！");
}

syncToR2();