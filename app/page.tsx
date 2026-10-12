import JobDashboard from "@/components/JobDashboard";
import ExternalJobSearch from "@/components/ExternalJobSearch";
import AutoApplyQueue from "@/components/AutoApplyQueue";
import ResumeGenerator from "@/components/ResumeGenerator";
import { jobs } from "@/lib/jobs";

export default function Home() {
  return (
    <>
      <JobDashboard jobs={jobs} />
      <section id="discover" className="section-anchor"><ExternalJobSearch /></section>
      <section id="resume" className="section-anchor"><ResumeGenerator /></section>
      <section id="applications" className="section-anchor"><AutoApplyQueue /></section>
    </>
  );
}
