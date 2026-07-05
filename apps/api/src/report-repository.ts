import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { SentinelReport } from "@sentinelmesh/shared";

export interface ReportRepository {
  list(): Promise<SentinelReport[]>;
  get(id: string): Promise<SentinelReport | undefined>;
  insert(report: SentinelReport): Promise<void>;
  replace(report: SentinelReport): Promise<boolean>;
}

export class JsonReportRepository implements ReportRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async list() {
    await this.writeQueue;
    return this.read();
  }

  async get(id: string) {
    return (await this.list()).find((report) => report.id === id);
  }

  async insert(report: SentinelReport) {
    await this.enqueue(async () => {
      const reports = await this.read();
      reports.unshift(report);
      await this.write(reports);
    });
  }

  async replace(report: SentinelReport) {
    let replaced = false;
    await this.enqueue(async () => {
      const reports = await this.read();
      const index = reports.findIndex((candidate) => candidate.id === report.id);
      if (index === -1) return;
      reports[index] = report;
      replaced = true;
      await this.write(reports);
    });
    return replaced;
  }

  private async enqueue(operation: () => Promise<void>) {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next.catch(() => undefined);
    await next;
  }

  private async read(): Promise<SentinelReport[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as SentinelReport[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(reports: SentinelReport[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomSuffix()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export class PostgresReportRepository implements ReportRepository {
  private constructor(private readonly pool: Pool) {}

  static async connect(connectionString: string, ssl: boolean) {
    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: ssl ? { rejectUnauthorized: false } : undefined
    });
    const repository = new PostgresReportRepository(pool);
    await repository.initialize();
    return repository;
  }

  async list() {
    const result = await this.pool.query<{ payload: SentinelReport }>(
      "SELECT payload FROM sentinel_reports ORDER BY created_at DESC"
    );
    return result.rows.map((row) => row.payload);
  }

  async get(id: string) {
    const result = await this.pool.query<{ payload: SentinelReport }>(
      "SELECT payload FROM sentinel_reports WHERE id = $1 LIMIT 1",
      [id]
    );
    return result.rows[0]?.payload;
  }

  async insert(report: SentinelReport) {
    await this.pool.query(
      `INSERT INTO sentinel_reports (id, user_address, created_at, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [report.id, report.userAddress?.toLowerCase() ?? null, report.createdAt, JSON.stringify(report)]
    );
  }

  async replace(report: SentinelReport) {
    const result = await this.pool.query(
      `UPDATE sentinel_reports
       SET user_address = $2, created_at = $3, payload = $4::jsonb
       WHERE id = $1`,
      [report.id, report.userAddress?.toLowerCase() ?? null, report.createdAt, JSON.stringify(report)]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sentinel_reports (
        id text PRIMARY KEY,
        user_address text,
        created_at timestamptz NOT NULL,
        payload jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sentinel_reports_created_at_idx
        ON sentinel_reports (created_at DESC);
      CREATE INDEX IF NOT EXISTS sentinel_reports_user_address_idx
        ON sentinel_reports (user_address, created_at DESC);
    `);
  }
}

export async function createReportRepository({
  jsonPath,
  databaseUrl,
  databaseSsl
}: {
  jsonPath: string;
  databaseUrl?: string;
  databaseSsl: boolean;
}): Promise<{ repository: ReportRepository; provider: "json" | "postgres" }> {
  if (databaseUrl) {
    return {
      repository: await PostgresReportRepository.connect(databaseUrl, databaseSsl),
      provider: "postgres"
    };
  }
  return { repository: new JsonReportRepository(jsonPath), provider: "json" };
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}
