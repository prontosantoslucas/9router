/**
 * Pure JavaScript ZIP Exporter (PKZIP format)
 * Generates an uncompressed/STORE ZIP file Blob from an array of files.
 */
export function createZipBlob(files) {
  const fileEntries = [];
  let offset = 0;

  const textEncoder = new TextEncoder();

  // 1. Process files and create local file headers
  const localHeaders = files.map((file) => {
    const filenameBytes = textEncoder.encode(file.path.replace(/^\//, ""));
    const contentBytes = typeof file.content === "string" ? textEncoder.encode(file.content) : file.content;

    const crc = computeCRC32(contentBytes);
    const size = contentBytes.length;

    // Local file header structure (30 bytes + filename + content)
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true);         // Version needed to extract (2.0)
    view.setUint16(6, 0, true);          // General purpose bit flag
    view.setUint16(8, 0, true);          // Compression method (0 = STORE)
    view.setUint16(10, 0, true);         // File last modification time
    view.setUint16(12, 0, true);         // File last modification date
    view.setUint32(14, crc, true);       // CRC-32
    view.setUint32(18, size, true);      // Compressed size
    view.setUint32(22, size, true);      // Uncompressed size
    view.setUint16(26, filenameBytes.length, true); // Filename length
    view.setUint16(28, 0, true);         // Extra field length

    header.set(filenameBytes, 30);

    const entryOffset = offset;
    offset += header.length + contentBytes.length;

    fileEntries.push({
      filenameBytes,
      crc,
      size,
      offset: entryOffset,
    });

    return concatTypedArrays(header, contentBytes);
  });

  const localHeaderBuffer = concatTypedArrays(...localHeaders);

  // 2. Process central directory headers
  let centralDirectorySize = 0;
  const centralHeaders = fileEntries.map((entry) => {
    const header = new Uint8Array(46 + entry.filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x02014b50, true); // Central directory header signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed to extract
    view.setUint16(8, 0, true);          // General purpose bit flag
    view.setUint16(10, 0, true);         // Compression method
    view.setUint16(12, 0, true);         // File last mod time
    view.setUint16(14, 0, true);         // File last mod date
    view.setUint32(16, entry.crc, true); // CRC-32
    view.setUint32(20, entry.size, true);// Compressed size
    view.setUint32(24, entry.size, true);// Uncompressed size
    view.setUint16(28, entry.filenameBytes.length, true); // Filename length
    view.setUint16(30, 0, true);         // Extra field length
    view.setUint16(32, 0, true);         // File comment length
    view.setUint16(34, 0, true);         // Disk number start
    view.setUint16(36, 0, true);         // Internal file attributes
    view.setUint32(38, 0, true);         // External file attributes
    view.setUint32(42, entry.offset, true); // Relative offset of local header

    header.set(entry.filenameBytes, 46);
    centralDirectorySize += header.length;

    return header;
  });

  const centralHeaderBuffer = concatTypedArrays(...centralHeaders);

  // 3. End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true);          // Disk number
  eocdView.setUint16(6, 0, true);          // Disk with central directory
  eocdView.setUint16(8, fileEntries.length, true);  // Number of central directory records on this disk
  eocdView.setUint16(10, fileEntries.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirectorySize, true); // Size of central directory
  eocdView.setUint32(16, localHeaderBuffer.length, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true);         // ZIP comment length

  return new Blob([localHeaderBuffer, centralHeaderBuffer, eocd], { type: "application/zip" });
}

export function downloadProjectAsZip(projectName, files) {
  const blob = createZipBlob(files);
  const link = document.createElement("a");
  const sanitizedName = (projectName || "project").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizedName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function concatTypedArrays(...arrays) {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function computeCRC32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();
