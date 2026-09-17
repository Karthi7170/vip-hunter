import JobDashboard from "@/components/JobDashboard";
import ExternalJobSearch from "@/components/ExternalJobSearch";
import AutoApplyQueue from "@/components/AutoApplyQueue";
import ResumeGenerator from "@/components/ResumeGenerator";
import { jobs } from "@/lib/jobs";

export default function Home() {
  return (
    <>
      <JobDashboard jobs={jobs} />
      <ResumeGenerator />
      <ExternalJobSearch />
      <AutoApplyQueue />
    </>
  );
}
