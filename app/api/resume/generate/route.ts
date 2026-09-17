import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createAdminSupabase } from "@/lib/supabase-admin";
import {
  filenameForResume,
  renderResumePdf,
  tailorResume,
  type ResumeRole,
} from "@/lib/resume-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

const roles = new Set<ResumeRole>([
  "manual-testing",
  "software-developer",
  "technical-support",
]);

async function extractText(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const result = await pdfParse(bytes);
    return result.text || "";
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value || "";
  }

  if (type.startsWith("text/") || name.endsWith(".txt")) {
    return bytes.toString("utf8");
  }

  throw new Error("Upload a PDF, DOCX, or TXT base resume.");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Sign in to generate a resume." }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Your session is invalid or expired. Sign in again." },
        { status: 401 },
      );
    }

    const form = await request.formData();
    const file = form.get("resume");
    const role = String(form.get("role") || "") as ResumeRole;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a base resume first." }, { status: 400 });
    }
    if (!roles.has(role)) {
      return NextResponse.json({ error: "Choose a valid target role." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Base resume must be 8 MB or smaller." }, { status: 400 });
    }

    const text = (await extractText(file)).trim();
    if (text.length < 80) {
      return NextResponse.json(
        { error: "Not enough readable resume text was found. Try a text-based PDF or DOCX file." },
        { status: 400 },
      );
    }

    const resume = tailorResume(text, role);
    const pdfBytes = await renderResumePdf(resume);
    const filename = filenameForResume(resume);

    return NextResponse.json({
      filename,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      resume,
      sourceFileName: file.name,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume generation failed." },
      { status: 500 },
    );
  }
}
