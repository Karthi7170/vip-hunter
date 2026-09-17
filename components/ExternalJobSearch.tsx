"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Clock3, ExternalLink, MapPin, Search, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./ExternalJobSearch.module.css";

type RoleKey = "qa" | "developer" | "support";
type LocationKey = "chennai" | "coimbatore" | "kerala";

const roles: Record<RoleKey, { label: string; query: string }> = {
  qa: { label: "Manual Testing / QA", query: "manual testing QA software tester fresher" },
  developer: { label: "Software Developer", query: "software developer fresher entry level" },
  support: { label: "System / Technical Support", query: "system engineer technical support fresher" },
};

const locations: Record<LocationKey, { label: string; query: string }> = {
  chennai: { label: "Chennai", query: "Chennai, Tamil Nadu, India" },
  coimbatore: { label: "Coimbatore", query: "Coimbatore, Tamil Nadu, India" },
  kerala: { label: "Kerala", query: "Kerala, India" },
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ExternalJobSearch() {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<RoleKey>("qa");
  const [location, setLocation] = useState<LocationKey>("chennai");

  useEffect(() => {
    let active = true;

    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
      setReady(true);
    });

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  const searches = useMemo(() => {
    const roleData = roles[role];
    const locationData = locations[location];
    const q = encodeURIComponent(roleData.query);
    const loc = encodeURIComponent(locationData.query);

    const naukriRole = slug(roleData.label.replace("/", " "));
    const naukriLocation = slug(locationData.label);

    return [
      {
        name: "LinkedIn Jobs",
        href: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&f_TPR=r604800&f_E=2&sortBy=DD`,
        freshness: "Past 7 days",
        note: "Entry-level filter included",
      },
      {
        name: "Naukri",
        href: `https://www.naukri.com/${naukriRole}-jobs-in-${naukriLocation}?k=${q}&l=${encodeURIComponent(locationData.label)}&experience=0&jobAge=7`,
        freshness: "Past 7 days",
        note: "0-year experience target",
      },
      {
        name: "Indeed",
        href: `https://in.indeed.com/jobs?q=${q}&l=${loc}&fromage=7&sort=date`,
        freshness: "Past 7 days",
        note: "Newest results first",
      },
    ];
  }, [role, location]);

  if (!ready || !signedIn) return null;

  return (
    <section className={styles.shell} aria-label="External job search">
      <div className={styles.panel}>
        <div className={styles.top}>
          <div>
            <span className={styles.eyebrow}>
              <Search size={14} /> AI-MAD External Search
            </span>
            <h2 className={styles.title}>Search LinkedIn, Naukri and Indeed</h2>
            <p className={styles.description}>
              Open pre-filtered searches for your target role and city while VIP-Hunter continues scanning free public ATS feeds in the background.
            </p>
          </div>
          <span className={styles.badge}>Manual apply · No scraping</span>
        </div>

        <div className={styles.controls}>
          <label className={styles.control}>
            <span>Target role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as RoleKey)}>
              {Object.entries(roles).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.control}>
            <span>Location</span>
            <select value={location} onChange={(event) => setLocation(event.target.value as LocationKey)}>
              {Object.entries(locations).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.grid}>
          {searches.map((source) => (
            <a key={source.name} className={styles.card} href={source.href} target="_blank" rel="noreferrer">
              <div className={styles.cardHeader}>
                <span className={styles.source}>{source.name}</span>
                <ExternalLink className={styles.external} size={17} />
              </div>

              <div className={styles.meta}>
                <span><BriefcaseBusiness size={14} /> {roles[role].label}</span>
                <span><MapPin size={14} /> {locations[location].label}</span>
                <span><Clock3 size={14} /> {source.freshness}</span>
              </div>

              <div className={styles.action}>
                <span>{source.note}</span>
                <span>Search now →</span>
              </div>
            </a>
          ))}
        </div>

        <p className={styles.note}>
          <ShieldCheck size={15} /> These buttons open the official job sites in a new tab. VIP-Hunter does not auto-submit applications or bypass LinkedIn, Naukri or Indeed access controls. You may need to sign in on those sites.
        </p>
      </div>
    </section>
  );
}
