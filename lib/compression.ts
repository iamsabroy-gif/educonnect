import zlib from "zlib";

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/** Gzip a file buffer before storing it in the file_data column. */
export function compressBuffer(data: Buffer): Buffer {
  return zlib.gzipSync(data);
}

/**
 * Gunzip a file buffer read back from the file_data column. Falls back to
 * returning the input unchanged if it isn't gzip-compressed, so rows stored
 * before compression was added still download correctly.
 */
export function decompressBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  const buf = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  if (buf.length < 2 || !buf.subarray(0, 2).equals(GZIP_MAGIC)) {
    return buf;
  }
  return zlib.gunzipSync(buf);
}
