"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <div onClick={() => router.push("/dashboard")} style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",cursor:"pointer" }}>
      <div style={{ textAlign:"center",maxWidth:520,padding:40 }}>
        <div style={{ display:"inline-flex",alignItems:"center",gap:12,marginBottom:40 }}>
          <div style={{ width:48,height:48,background:"var(--acc)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:"var(--bg)" }}>CO</div>
          <div style={{ fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,letterSpacing:-1,color:"var(--t1)" }}>CageOS</div>
        </div>
        <div style={{ fontSize:16,color:"var(--t2)",lineHeight:1.6,marginBottom:48 }}>The first equipment checkout system built for <strong style={{ color:"var(--t1)",fontWeight:500 }}>production shops</strong> — not adapted from IT.</div>
        <div className="animate-breathe" style={{ display:"inline-flex",alignItems:"center",gap:8,background:"var(--acc)",color:"var(--bg)",padding:"14px 32px",borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700 }}>Touch anywhere to start →</div>
        <div style={{ marginTop:24,fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--t3)" }}>NAB Show 2026 · Las Vegas</div>
      </div>
    </div>
  );
}
