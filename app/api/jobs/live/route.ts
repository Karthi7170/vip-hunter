import { NextRequest, NextResponse } from "next/server";
import { findLiveJobs } from "@/lib/find-jobs";
import { persistJobs } from "@/lib/persist-jobs";
export const runtime="nodejs"; export const maxDuration=60;
export async function POST(request:NextRequest){const expectedPin=process.env.APP_PIN;const suppliedPin=request.headers.get("x-app-pin");if(!expectedPin||suppliedPin!==expectedPin)return NextResponse.json({error:"Invalid app PIN or APP_PIN is not configured."},{status:401});try{const jobs=await findLiveJobs();const persisted=await persistJobs(jobs);return NextResponse.json({jobs,persisted:persisted.count,updatedAt:new Date().toISOString()})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Search failed"},{status:500})}}
