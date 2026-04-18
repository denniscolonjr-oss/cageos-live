"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/kiosk", label: "Kiosk" },
  { href: "/profile", label: "Team" },
  { href: "/product", label: "Product" },
];

export default function TopNav() {
  const path = usePathname();

  return (
    <nav style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:50,padding:"0 20px",borderBottom:"1px solid var(--b1)",background:"var(--bg)",flexShrink:0,zIndex:50 }}>
      <Link href="/" style={{ display:"flex",alignItems:"center",gap:8,textDecoration:"none" }}>
        <div style={{ width:28,height:28,background:"var(--acc)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:500,color:"var(--bg)" }}>CO</div>
        <span style={{ fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,letterSpacing:-0.5,color:"var(--t1)" }}>CageOS</span>
      </Link>

      <div style={{ display:"flex",gap:2,background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:7,padding:3 }}>
        {TABS.map(t => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} style={{ padding:"5px 16px",borderRadius:5,fontSize:12,fontWeight:500,color:active?"var(--t1)":"var(--t2)",background:active?"var(--s3)":"transparent",textDecoration:"none",transition:"all 0.15s",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap" }}>
              {t.label}
            </Link>
          );
        })}
      </div>

      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:500,color:"var(--acc)",background:"rgba(226,245,92,0.1)",border:"1px solid rgba(226,245,92,0.3)",padding:"4px 10px",borderRadius:4,letterSpacing:"0.05em" }}>NAB 2026</div>
        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--t3)",background:"var(--s1)",border:"1px solid var(--b1)",padding:"4px 10px",borderRadius:4 }}>MMG Production · DC</div>
      </div>
    </nav>
  );
}
