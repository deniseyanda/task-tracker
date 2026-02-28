import { execSync } from "child_process";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const DRIVE_REMOTE = "manus_google_drive";
const CLIENTS_PATH = "CLIENTES";

// Google Drive base URL for opening files/folders
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/";
const DRIVE_FILE_URL = "https://drive.google.com/file/d/";
const DRIVE_DOC_URL = "https://docs.google.com/document/d/";
const DRIVE_SHEET_URL = "https://docs.google.com/spreadsheets/d/";

type DriveItem = {
  ID: string;
  Name: string;
  Size: number;
  MimeType: string;
  IsDir: boolean;
  ModTime?: string;
};

function rcloneLsJson(path: string, dirsOnly = false, maxDepth = 1): DriveItem[] {
  try {
    const dirsFlag = dirsOnly ? "--dirs-only" : "";
    const depthFlag = maxDepth > 1 ? `--max-depth ${maxDepth}` : "";
    const cmd = `rclone lsjson "${DRIVE_REMOTE}:${path}" --config ${RCLONE_CONFIG} --no-modtime ${dirsFlag} ${depthFlag} 2>/dev/null`;
    const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
    return JSON.parse(output) as DriveItem[];
  } catch {
    return [];
  }
}

function getDriveUrl(item: DriveItem): string {
  if (item.IsDir) return `${DRIVE_FOLDER_URL}${item.ID}`;
  const mime = item.MimeType ?? "";
  if (mime.includes("document")) return `${DRIVE_DOC_URL}${item.ID}/edit`;
  if (mime.includes("spreadsheet")) return `${DRIVE_SHEET_URL}${item.ID}/edit`;
  if (mime.includes("presentation")) return `https://docs.google.com/presentation/d/${item.ID}/edit`;
  return `${DRIVE_FILE_URL}${item.ID}/view`;
}

function getFileIcon(item: DriveItem): string {
  if (item.IsDir) return "folder";
  const mime = item.MimeType ?? "";
  if (mime.includes("document")) return "doc";
  if (mime.includes("spreadsheet")) return "sheet";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("image")) return "image";
  if (mime.includes("video")) return "video";
  if (mime.includes("audio")) return "audio";
  return "file";
}

export const driveRouter = router({
  // List all clients from CLIENTES folder
  listClients: protectedProcedure.query(async () => {
    const items = rcloneLsJson(CLIENTS_PATH, true);
    return items.map((item) => ({
      id: item.ID,
      name: item.Name,
      path: `${CLIENTS_PATH}/${item.Name}`,
      driveUrl: `${DRIVE_FOLDER_URL}${item.ID}`,
    }));
  }),

  // List files/folders inside a client folder
  listClientFiles: protectedProcedure
    .input(z.object({ clientName: z.string(), subfolder: z.string().optional() }))
    .query(async ({ input }) => {
      const basePath = `${CLIENTS_PATH}/${input.clientName}`;
      const path = input.subfolder ? `${basePath}/${input.subfolder}` : basePath;
      const items = rcloneLsJson(path);
      return items.map((item) => ({
        id: item.ID,
        name: item.Name,
        isDir: item.IsDir,
        mimeType: item.MimeType,
        size: item.Size,
        icon: getFileIcon(item),
        driveUrl: getDriveUrl(item),
        path: input.subfolder ? `${input.subfolder}/${item.Name}` : item.Name,
      }));
    }),

  // Search across all clients
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();

      // First search client names
      const clients = rcloneLsJson(CLIENTS_PATH, true);
      const matchedClients = clients
        .filter((c) => c.Name.toLowerCase().includes(q))
        .map((c) => ({
          type: "client" as const,
          id: c.ID,
          name: c.Name,
          path: `${CLIENTS_PATH}/${c.Name}`,
          driveUrl: `${DRIVE_FOLDER_URL}${c.ID}`,
          clientName: c.Name,
        }));

      // Then search files inside each matched client (up to 5 clients to avoid timeout)
      const fileResults: {
        type: "file";
        id: string;
        name: string;
        path: string;
        driveUrl: string;
        clientName: string;
        icon: string;
        isDir: boolean;
      }[] = [];

      for (const client of clients.slice(0, 30)) {
        try {
          const files = rcloneLsJson(`${CLIENTS_PATH}/${client.Name}`);
          for (const file of files) {
            if (file.Name.toLowerCase().includes(q)) {
              fileResults.push({
                type: "file",
                id: file.ID,
                name: file.Name,
                path: `${CLIENTS_PATH}/${client.Name}/${file.Name}`,
                driveUrl: getDriveUrl(file),
                clientName: client.Name,
                icon: getFileIcon(file),
                isDir: file.IsDir,
              });
            }
          }
        } catch {
          // Skip clients that can't be read
        }
        if (fileResults.length >= 20) break;
      }

      return {
        clients: matchedClients,
        files: fileResults,
        total: matchedClients.length + fileResults.length,
      };
    }),

  // Get a shareable link for a specific file
  getShareLink: protectedProcedure
    .input(z.object({ fileId: z.string(), isDir: z.boolean() }))
    .query(async ({ input }) => {
      if (input.isDir) {
        return { url: `${DRIVE_FOLDER_URL}${input.fileId}` };
      }
      return { url: `${DRIVE_FILE_URL}${input.fileId}/view` };
    }),
});
