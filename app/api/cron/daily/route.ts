import { NextRequest,NextResponse } from "next/server";
import { findLiveJobs } from "@/lib/find-jobs";
import { persistJobs } from "@/lib/persist-jobs";
import { sendDailyWhatsApp,whatsappConfigured } from "@/lib/whatsapp";
export const runtime="nodejs";export const maxDuration=60;
export async function GET(req:NextRequest){if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});try{const jobs=await findLiveJobs();const persisted=await persistJobs(jobs);let whatsapp:{sent:boolean;reason?:string;messageId?:string}={sent:false,reason:whatsappConfigured()?"No notification attempted":"WhatsApp Cloud API is not fully configured"};if(jobs.length&&whatsappConfigured()){try{whatsapp=await sendDailyWhatsApp(jobs)}catch(error){whatsapp={sent:false,reason:error instanceof Error?error.message:"WhatsApp send failed"}}}return NextResponse.json({success:true,count:jobs.length,persisted:persisted.count,whatsapp,jobs,runAt:new Date().toISOString()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Daily run failed"},{status:500})}}
