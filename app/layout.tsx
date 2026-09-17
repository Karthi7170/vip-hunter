import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"VIP-Hunter",description:"Private AI job discovery and application tracking dashboard."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
