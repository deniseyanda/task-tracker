/**
 * Import Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Excel file upload, parsing, preview and bulk task import.
 * Uses multer for multipart form data and xlsx for spreadsheet parsing.
 *
 * Endpoints (REST, not tRPC — because file upload requires multipart):
 *   POST /api/import/preview   → parse file, return rows for preview
 *   POST /api/import/confirm   → create projects + tasks from parsed rows
 *
 * Column mapping (matches the user's original spreadsheet):
 *   Col A: Projeto     → project name (auto-create if not exists)
 *   Col B: Tarefa      → task title (skip if empty)
 *   Col C: Quadrante   → Q1/Q2/Q3/Q4 → priority mapping
 *   Col D: Urgente     → sim/não
 *   Col E: Importante  → sim/não
 *   Col F: Ação        → FAZER/AGENDAR/DELEGAR/ELIMINAR → status mapping
 *   Col G: Data        → deadline (Date object from xlsx)
 *   Col H: Status      → free text (ignored, derived from Ação)
 */

import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDb } from "../db";
import { projects, tasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createContext } from "../_core/context";

const router = express.Router();

// Store file in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx ou .xls são aceitos"));
    }
  },
});

// ─── Priority / Status mapping ────────────────────────────────────────────────

function quadranteToPriority(q: string): "alta" | "media" | "baixa" {
  if (q === "Q1") return "alta";
  if (q === "Q2") return "media";
  return "baixa";
}

function acaoToStatus(acao: string): "backlog" | "em_andamento" | "concluido" | "bloqueado" {
  const a = (acao || "").toUpperCase().trim();
  if (a === "FAZER") return "em_andamento";
  if (a === "AGENDAR") return "backlog";
  if (a === "DELEGAR") return "bloqueado";
  // ELIMINAR → backlog (user can decide later)
  return "backlog";
}

function parseDate(val: unknown): number | null {
  if (!val) return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d).getTime();
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

// ─── Parse workbook buffer into row objects ───────────────────────────────────

interface ParsedRow {
  projeto: string;
  tarefa: string;
  quadrante: string;
  urgente: string;
  importante: string;
  acao: string;
  data: number | null;
  priority: "alta" | "media" | "baixa";
  status: "backlog" | "em_andamento" | "concluido" | "bloqueado";
  rowIndex: number;
}

function parseExcelBuffer(buffer: Buffer): { rows: ParsedRow[]; errors: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  // Try to find the sheet with task data (look for "Projeto" header)
  let ws: XLSX.WorkSheet | null = null;
  let dataStartRow = 1;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    // Find the header row containing "Projeto" and "Tarefa"
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const row = raw[i] as unknown[];
      const rowStr = row.map(c => String(c ?? "").toLowerCase());
      if (rowStr.includes("projeto") && rowStr.includes("tarefa")) {
        ws = sheet;
        dataStartRow = i + 1; // 0-indexed, data starts next row
        break;
      }
    }
    if (ws) break;
  }

  if (!ws) {
    errors.push("Não foi possível encontrar a aba com colunas 'Projeto' e 'Tarefa'.");
    return { rows, errors };
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Find column indices from header row
  const headerRow = (raw[dataStartRow - 1] as unknown[]).map(c =>
    String(c ?? "").toLowerCase().trim()
  );
  const colIdx = {
    projeto: headerRow.findIndex(h => h.includes("projeto")),
    tarefa: headerRow.findIndex(h => h.includes("tarefa")),
    quadrante: headerRow.findIndex(h => h.includes("quadrante")),
    urgente: headerRow.findIndex(h => h.includes("urgente")),
    importante: headerRow.findIndex(h => h.includes("importante")),
    acao: headerRow.findIndex(h => h.includes("ação") || h.includes("acao")),
    data: headerRow.findIndex(h => h.includes("data")),
  };

  let lastProjeto = "";

  for (let i = dataStartRow; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row || row.every(c => !c)) continue;

    const tarefa = String(row[colIdx.tarefa] ?? "").trim();
    if (!tarefa) continue; // skip rows without task title

    const projeto = String(row[colIdx.projeto] ?? lastProjeto ?? "").trim() || "Geral";
    if (row[colIdx.projeto]) lastProjeto = projeto;

    const quadrante = String(row[colIdx.quadrante] ?? "Q4").trim().toUpperCase();
    const urgente = String(row[colIdx.urgente] ?? "").trim();
    const importante = String(row[colIdx.importante] ?? "").trim();
    const acao = String(row[colIdx.acao] ?? "").trim();
    const dataVal = colIdx.data >= 0 ? row[colIdx.data] : null;
    const deadline = parseDate(dataVal);

    rows.push({
      projeto,
      tarefa,
      quadrante,
      urgente,
      importante,
      acao,
      data: deadline,
      priority: quadranteToPriority(quadrante),
      status: acaoToStatus(acao),
      rowIndex: i + 1,
    });
  }

  return { rows, errors };
}

// ─── POST /api/import/preview ─────────────────────────────────────────────────

router.post("/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const { rows, errors } = parseExcelBuffer(req.file.buffer);

    // Group by project for summary
    const projectMap: Record<string, number> = {};
    for (const row of rows) {
      projectMap[row.projeto] = (projectMap[row.projeto] || 0) + 1;
    }

    return res.json({
      totalRows: rows.length,
      projects: Object.entries(projectMap).map(([name, count]) => ({ name, count })),
      rows: rows.slice(0, 50), // preview first 50 rows
      errors,
    });
  } catch (err: unknown) {
    console.error("[Import] Preview error:", err);
    return res.status(500).json({ error: "Erro ao processar o arquivo." });
  }
});

// ─── POST /api/import/confirm ─────────────────────────────────────────────────

router.post("/confirm", upload.single("file"), async (req, res) => {
  try {
    // Auth check via cookie
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    const userId = ctx.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const { rows, errors } = parseExcelBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Nenhuma tarefa encontrada no arquivo.", errors });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Banco de dados indisponível." });
    }

    // Cache project name → id to avoid duplicate inserts
    const projectCache: Record<string, number> = {};

    // Load existing projects for this user
    const existingProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId));
    for (const p of existingProjects) {
      projectCache[p.name] = p.id;
    }

    let createdTasks = 0;
    let createdProjects = 0;

    for (const row of rows) {
      // Ensure project exists
      if (!projectCache[row.projeto]) {
        const [result] = await db.insert(projects).values({
          userId,
          name: row.projeto,
          color: "#dc2626",
        });
        projectCache[row.projeto] = (result as { insertId: number }).insertId;
        createdProjects++;
      }

      const projectId = projectCache[row.projeto];

      // Insert task
      await db.insert(tasks).values({
        userId,
        projectId,
        title: row.tarefa,
        description: row.acao ? `Ação: ${row.acao}` : null,
        status: row.status,
        priority: row.priority,
        deadline: row.data ?? null, // bigint (UTC ms)
        assignee: null,
      });
      createdTasks++;
    }

    return res.json({
      success: true,
      createdTasks,
      createdProjects,
      message: `${createdTasks} tarefa(s) e ${createdProjects} projeto(s) importados com sucesso.`,
    });
  } catch (err: unknown) {
    console.error("[Import] Confirm error:", err);
    return res.status(500).json({ error: "Erro ao importar tarefas." });
  }
});

export default router;
