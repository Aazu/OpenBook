const path = require("path");
const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");

/**
 * Azure Blob storage adapter.
 * Env:
 *  AZURE_STORAGE_CONNECTION_STRING
 *  AZURE_BLOB_CONTAINER (default: openbooks-media)
 */
async function ensureContainer() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");
  const containerName = process.env.AZURE_BLOB_CONTAINER || "openbooks-media";
  const svc = BlobServiceClient.fromConnectionString(conn);
  const container = svc.getContainerClient(containerName);
  await container.createIfNotExists({ access: "blob" }); // public read for coursework demo
  return container;
}

async function uploadBufferToBlob(filename, buffer, contentType) {
  const container = await ensureContainer();
  const blobName = `${Date.now()}_${filename}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const block = container.getBlockBlobClient(blobName);
  await block.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" }
  });
  return block.url;
}

module.exports = { uploadBufferToBlob };
