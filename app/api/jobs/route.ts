import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-admin";
export async function GET(){try{const db=createAdminSupabase();const since=new Date(Date.now()-24*60*60*1000).toISOString();const {data,error}=await db.from("jobs").select("*").gte("discovered_at",since).order("discovered_at",{ascending:false}).limit(50);if(error)throw error;return NextResponse.json({jobs:data??[],updatedAt:new Date().toISOString()})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Database read failed"},{status:500})}}
