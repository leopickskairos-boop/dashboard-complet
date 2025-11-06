import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

/**
 * Abstract interface for file storage
 * Allows future migration to object storage (S3, Replit Object Storage, etc.)
 */
export interface IFileStorage {
  /**
   * Save a buffer to storage and return the file path/URL
   */
  save(buffer: Buffer, filename: string): Promise<string>;

  /**
   * Read a file from storage
   */
  read(filePath: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Calculate checksum of a buffer
   */
  calculateChecksum(buffer: Buffer): string;
}

/**
 * Filesystem-based storage implementation
 * Stores PDFs in a local directory structure
 */
export class FilesystemStorage implements IFileStorage {
  private baseDir: string;

  constructor(baseDir: string = "./reports") {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      console.log(`[FileStorage] Storage directory initialized: ${this.baseDir}`);
    } catch (error) {
      console.error("[FileStorage] Failed to initialize storage directory:", error);
      throw error;
    }
  }

  /**
   * Save a buffer to filesystem
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    try {
      // Sanitize filename
      const sanitizedFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.baseDir, sanitizedFilename);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      console.log(`[FileStorage] File saved: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error("[FileStorage] Failed to save file:", error);
      throw error;
    }
  }

  /**
   * Read a file from filesystem
   */
  async read(filePath: string): Promise<Buffer> {
    try {
      const safePath = this.validatePath(filePath);
      const buffer = await fs.readFile(safePath);
      console.log(`[FileStorage] File read: ${safePath}`);
      return buffer;
    } catch (error) {
      console.error("[FileStorage] Failed to read file:", error);
      throw error;
    }
  }

  /**
   * Delete a file from filesystem
   */
  async delete(filePath: string): Promise<void> {
    try {
      const safePath = this.validatePath(filePath);
      await fs.unlink(safePath);
      console.log(`[FileStorage] File deleted: ${safePath}`);
    } catch (error) {
      console.error("[FileStorage] Failed to delete file:", error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const safePath = this.validatePath(filePath);
      await fs.access(safePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate MD5 checksum of a buffer
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("md5").update(buffer).digest("hex");
  }

  /**
   * Validate and resolve a file path to ensure it's within baseDir
   * Prevents path traversal attacks
   */
  private validatePath(filePath: string): string {
    // Resolve the path relative to baseDir
    const resolved = path.resolve(this.baseDir, filePath);
    
    // Ensure the resolved path is within baseDir
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error(`Invalid file path: path traversal detected (${filePath})`);
    }
    
    return resolved;
  }

  /**
   * Sanitize filename to prevent directory traversal attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators and keep only the filename
    const basename = path.basename(filename);
    
    // Replace unsafe characters
    return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  /**
   * Clean up old reports (optional utility method)
   * Deletes reports older than the specified number of days
   */
  async cleanupOldReports(daysToKeep: number = 90): Promise<number> {
    try {
      const files = await fs.readdir(this.baseDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && now - stats.mtimeMs > maxAge) {
          await this.delete(filePath);
          deletedCount++;
        }
      }

      console.log(`[FileStorage] Cleanup: ${deletedCount} old files deleted`);
      return deletedCount;
    } catch (error) {
      console.error("[FileStorage] Failed to clean up old reports:", error);
      throw error;
    }
  }
}

/**
 * Singleton instance for file storage
 */
export const fileStorage = new FilesystemStorage();

/**
 * Initialize file storage on module load
 */
fileStorage.initialize().catch(console.error);
